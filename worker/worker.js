/**
 * Prospector design agent — Cloudflare Worker (generative mode)
 *
 * Holds the Anthropic API key server-side. For each prospect it:
 *   1. Scrapes the prospect's real website via Jina Reader (JS-rendered markdown)
 *   2. DESIGN pass — Claude writes a COMPLETE, bespoke, single-file HTML website
 *      from scratch (custom CSS/JS/animation), grounded in the scraped content +
 *      brand. No templates.
 *   3. ART-DIRECTOR pass — Claude critiques the page against a rubric and returns
 *      a refined full HTML document.
 *   4. Validates/repairs and returns the final HTML.
 *
 * Visuals policy (Option A): all imagery is CSS gradients / CSS shapes / SVG /
 * canvas + the business's logo. No external photo files.
 *
 * Deploy: see README.md.
 */

import { designBrief, qaChecklist, classifyDomain } from './design-knowledge.js';
import { threeRecipes } from './three-recipes.js';
import { captureFrames } from './screenshot.js';
import { exemplarBlock } from './exemplars.js';

const MODEL = 'claude-opus-4-8';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 32000;

// ── Prompts ─────────────────────────────────────────────────────────────────
function designSystem() {
  return [
    'You are an award-winning creative web designer and front-end developer.',
    'You build the kind of bespoke marketing sites a top agency charges thousands for.',
    'Produce a COMPLETE, self-contained, single-file HTML5 landing page for the specific local business described by the user.',
    '',
    'OUTPUT RULES (critical):',
    '- Output ONLY the HTML document. Start with <!DOCTYPE html> and end with </html>.',
    '- No markdown, no code fences, no commentary before or after.',
    '',
    '═══ VISUAL IDENTITY — what makes the site look state-of-the-art ═══',
    '',
    'INLINE SVG IS YOUR PRIMARY ILLUSTRATION MEDIUM (mandatory):',
    '- Draw bespoke inline <svg> artwork — this is how you create rich imagery without photos.',
    '- Every service card MUST have a custom SVG icon (20–40px), not a unicode character or emoji.',
    '  Examples: a stylised molar/tooth cross-section for a dentist, a wrench + gear for a garage,',
    '  a diamond/gem for a jeweller, scissors for a salon. Use <path> with clean curves, not text.',
    '- The hero section MUST contain a substantial decorative SVG illustration (200–600px) that',
    '  relates to the trade: e.g. an abstract dental chair silhouette, a stylised car outline,',
    '  a flowing hair shape, or a geometric cityscape. This is the centrepiece artwork.',
    '- Use SVG gradients (<linearGradient>, <radialGradient>), filters (feGaussianBlur, feDropShadow),',
    '  blend modes, masks, and clipping paths. Animate 1–3 elements with CSS @keyframes or',
    '  GSAP for subtle life: a gentle float, a slow pulse, a rotating accent.',
    '- Add at least one SVG divider or decorative break between sections — not just a horizontal rule.',
    '- NEVER use unicode symbols (◈ ◆ ◉ ✦ ▸ ● ■) as icons. NEVER use emoji as icons.',
    '',
    'COLOUR & TYPOGRAPHY:',
    '- A DESIGN INTELLIGENCE section below provides curated palette and font options matched to',
    '  this business type. Pick the palette and font pairing that best fit the brand mood,',
    '  or blend elements from multiple candidates. Define everything as CSS custom properties in :root.',
    '- Use two typefaces maximum (heading + body), loaded via Google Fonts.',
    '- Dark text on light backgrounds must have 4.5:1 contrast minimum (WCAG AA).',
    '',
    'THE EXPERIENCE — the whole page is the wow moment (a flat brochure will NOT sell):',
    '- Build an IMMERSIVE CINEMATIC page in the style of award-winning studio sites: ONE fixed full-viewport WebGL scene behind everything, with the content scrolling over it as "chapters" while a scroll-driven camera flies through the 3D world.',
    '- The 3D world is procedural and asset-free: a two-tone particle universe + a signature parametric light-strand + a glowing wireframe centrepiece, all glowing via UnrealBloom. Tune every colour to the brand palette; pick strand/centrepiece shapes that evoke the trade.',
    '- Choreograph 3-5 camera chapters across the scroll (push-in, orbit, close approach, settle on CTA). Motion must feel weighty and smooth: scrubbed timeline + eased camera + mouse parallax.',
    '- ALIVE ON LOAD: the scene MUST have continuous ambient motion (slow rotation, particle drift, bloom breathing) that runs the instant the page opens, WITHOUT any scroll or mouse input — see the AMBIENT MOTION recipe. A page that only moves when you scroll reads as a static image and fails. This is non-negotiable.',
    '- Follow the tested recipes below for ALL Three.js code. They are proven to render correctly — adapt parameters and shapes creatively, but keep the architecture, guards, and API usage exactly as shown. DO NOT use Vanta.js, particles.js, or any other pre-built background effect library.',
    '- LAYOUT VARIETY (mandatory — repeated centred stacks are the #1 thing that makes these pages look boring and templated): every chapter must use a DISTINCT layout, and no two consecutive chapters may share one. Draw from: full-bleed asymmetric hero; offset two-column (text left / visual right, then flip); bento grid of cards; vertical timeline with connector line; icon-left feature rows; big-number stat band; overlapping/staggered cards; a wide editorial pull-quote. At MOST one centred-stack chapter in the whole page. Vary alignment, column counts and rhythm deliberately.',
    '',
    'DESIGN PROCESS (do these steps IN ORDER — the concept comes before any code):',
    'STEP 1 — ANALYZE. From the scraped website, category, and reviews answer: What does this business actually sell? What is its ONE flagship product or service? Who is the customer and what do they feel (fear at the dentist, pride in their car, appetite, stress in a legal fight)? What are the brand colours, tone, language, and city?',
    'STEP 2 — CONCEPT. Invent the single 3D story that EXPLAINS that flagship offering — the 3D is not decoration, it is the pitch. Decide, justified by the trade: (a) the hero-product silhouette for the hologram moment (RECIPE G) — the thing they sell, drawn as a shape; (b) the parametric curve for the light-strand (RECIPE C) that matches the brand mood; (c) the centrepiece geometry (RECIPE D). Example: dental clinic -> particles form a glowing tooth while the copy talks about gentle precision; garage -> a gear/wrench forms while copy talks diagnostics.',
    'STEP 3 — STORYBOARD. Map 4-5 scroll chapters, each pairing ONE real message with ONE camera move: hero (name + promise, wide shot) -> craft/service chapter (push-in) -> the hologram reveal of the flagship offering (orbit) -> proof (stats/testimonials, close approach) -> CTA (settle). Name real services from the scrape in each chapter.',
    'STEP 4 — BUILD it with the recipes below.',
    'Record STEPS 1-3 as a short HTML comment placed immediately after <!DOCTYPE html> (max 12 lines): <!-- CONCEPT: offering=..., feeling=..., 3d-story=..., chapters=... -->. The art director will verify the scene matches the concept.',
    '',
    threeRecipes(),
    '',
    '═══ BUILD RULES ═══',
    '',
    '- Self-contained: all CSS in a <style> tag, all JS in a <script> tag.',
    '- You MAY use CDN <link>/<script> for Google Fonts and the exact Three.js/GSAP scripts listed in the recipes. Nothing else.',
    '- DO NOT reference any external image or photo files — none exist. Besides the WebGL scene, use CSS gradients, CSS shapes, and inline SVG. You may use the business LOGO URL if one is provided (as an <img>).',
    '- Editorial poster moments: at 1-2 chapters, set a single giant display word (10-18vw, heavyweight) product-film style, partially cropped/clipped for tension, relating to the trade (e.g. FRESH, PRECISION, SHINE). CRITICAL LEGIBILITY: on the near-black background it MUST be clearly visible — use EITHER a bright outlined treatment (transparent fill + 2px stroke via -webkit-text-stroke in a LIGHTENED brand/accent colour at 0.35-0.6 opacity) OR a solid fill in a light or accent tint at >=0.5 opacity. NEVER a dark-on-dark watermark, never opacity below 0.2 — if it is barely visible it is wrong. Place it above the vignette veil but behind the text content (z-index between them).',
    '- For product-led trades you may add an "exploded diagram" chapter: a layered inline SVG of the flagship product (5-8 stacked parts you draw yourself) whose parts translate apart on scroll (GSAP scrub), with thin leader lines labelling REAL services from the scrape.',
    '- For precision/tech-coded trades (dental, auto diagnostics, legal, security, medical, engineering — NOT restaurants/salons/cafes) you may frame the hologram moment (RECIPE G) with the scan/targeting HUD overlay (RECIPE H): corner brackets, reticle, scanline, and a small readout panel naming a real detail (a service, a precision stat) — fades in only while that hologram forms.',
    '- Ground all content in the scraped website: real service names, real tone, real city. No lorem ipsum, no generic filler ("Quality You Can Trust", "Your satisfaction is our priority").',
    '- Dark, deep backgrounds work best under bloom — keep the page near-black with the brand colour as the glow accent.',
    '- Chapters to include (adapt to the business): cinematic hero with name + tagline; services/offerings; a why-us or stats moment; testimonials; and a final CTA chapter with a (non-functional) contact form or booking button. Footer with real address/phone.',
    '- Text must stay readable over the 3D at every scroll position: scrims + text-shadows per the recipes, WCAG AA contrast.',
    '- Fully mobile-responsive (375px, 768px, 1024px, 1440px breakpoints); reduce particle counts and disable parallax on small screens.',
    '- Use cursor:pointer on all clickable elements.',
    '- Respect prefers-reduced-motion: disable animations, parallax, and the 3D scene under that media query (CSS gradient fallback per the recipes).',
    '- Add a fixed top banner: "Website Preview — concept mockup for <business name>". Offset the page so the banner does not overlap content.',
    '',
    'LANGUAGE RULE (important):',
    '- Detect the language of the scraped website content. If it is Dutch, write ALL visible text (headings, body, buttons, labels, section tags, CTA, footer) in Dutch. If French, write in French. Only use English if the original site is in English or no content was scraped. Never mix languages within a page.',
    '',
    'Aim for the reaction: "there is no way a local agency made this — I want it."',
  ].join('\n');
}

// CONCEPT pass — pure strategy, no code. Splitting this out means the build
// pass isn't inventing the concept and writing 6k tokens of correct WebGL in
// the same breath; it builds to a locked, considered brief.
function conceptSystem() {
  return [
    'You are an award-winning creative director planning a bespoke, cinematic WebGL website for a local business.',
    'Think hard about STRATEGY ONLY. Do NOT write any HTML, CSS, or JavaScript.',
    'Ground every decision in the scraped website, category, reviews and city — no generic filler.',
    '',
    'Output ONLY a single JSON object (no prose, no markdown fences) with EXACTLY these keys:',
    '{',
    '  "offering": "the ONE flagship product or service this business is really selling",',
    '  "feeling": "the core emotion the visitor should feel",',
    '  "3d_story": "how a procedural, asset-free 3D world visualises that offering — the 3D is the pitch, not decoration",',
    '  "silhouette": "the core product/service drawn as a single 2D shape for the hologram reveal (e.g. tooth, wrench, flacon, plate, gavel, house)",',
    '  "strand_curve": "one of: helix | torus-knot | flat-spiral-galaxy | lissajous-ribbon (choose by brand mood)",',
    '  "centrepiece": "the glowing wireframe hero geometry the camera flies around (e.g. icosahedron lattice, octahedron stack, torus-knot, sphere lattice)",',
    '  "use_hud": true or false — true ONLY for precision/tech-coded trades (dental, auto diagnostics, legal, medical, engineering, security); false for warm trades (restaurant, salon, cafe, bakery)",',
    '  "editorial_word": "the giant display word set behind the scene, written in the site language",',
    '  "palette": "which candidate palette you pick, and one line on why it fits the brand",',
    '  "fonts": "which candidate font pairing you pick, and one line on why",',
    '  "chapters": ["4-5 items, each formatted \'<message> — <camera move>\' and naming a REAL service/detail from the scrape"],',
    '  "language": "the ONE language all visible text must use, detected from the scraped content (Dutch, French, or English)",',
    '  "voice": "the tone of voice for ALL copy, inferred from the scraped content — e.g. \'warm and personal, Dutch je-form\', \'formal and authoritative, Dutch u-form\', \'playful and energetic\'; include the pronoun form for Dutch/French"',
    '}',
    '',
    'If BRAND colours are provided, anchor your "palette" choice to the real brand colours (adapt the',
    'dominant one into the glow/accent), rather than simply naming a generic candidate palette.',
  ].join('\n');
}

// Pull the first balanced JSON object out of the model's text.
function extractJson(t) {
  if (!t) return null;
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

// Render the approved concept as a locked brief for the build pass.
function conceptBrief(c) {
  if (!c) return '';
  const chapters = Array.isArray(c.chapters) ? c.chapters.map((x, i) => `    ${i + 1}. ${x}`).join('\n') : '';
  return [
    'APPROVED CONCEPT — a creative director has already locked the strategy below.',
    'BUILD TO IT FAITHFULLY. Do not re-invent it; spend your effort on flawless execution.',
    'Reproduce it verbatim in the required <!-- CONCEPT: ... --> comment.',
    '',
    `- offering: ${c.offering || ''}`,
    `- feeling: ${c.feeling || ''}`,
    `- 3d story: ${c['3d_story'] || ''}`,
    `- hologram silhouette (RECIPE G): ${c.silhouette || ''}`,
    `- light-strand curve (RECIPE C): ${c.strand_curve || ''}`,
    `- centrepiece geometry (RECIPE D): ${c.centrepiece || ''}`,
    `- scan/targeting HUD (RECIPE H): ${c.use_hud ? 'YES — this is a precision/tech trade' : 'NO — warm/casual trade, do not use it'}`,
    `- editorial poster word: ${c.editorial_word || ''}`,
    `- palette: ${c.palette || ''}`,
    `- fonts: ${c.fonts || ''}`,
    `- language for ALL visible text: ${c.language || 'match the scraped content'}`,
    `- voice — write EVERY line of copy in this tone: ${c.voice || 'match the scraped content'}`,
    '- chapters (pair each message with its camera move):',
    chapters,
  ].join('\n');
}

function reviewSystem(hasFrames) {
  const visual = hasFrames ? [
    '═══ VISUAL EVIDENCE — YOU CAN SEE THE RENDERED PAGE ═══',
    '',
    'Attached are real screenshots of this exact HTML rendered in a headless browser:',
    'several desktop scroll positions (0% = hero, through to 100% = final CTA) and one',
    'mobile hero at 390px wide. This is the actual output, not a mockup. TRUST YOUR EYES',
    'over the code — judge what genuinely appears on screen, then fix it in the HTML.',
    '',
    'Look critically for, and FIX, anything the screenshots reveal:',
    '- White-out / blown-out frames: bloom too strong, or the camera flew inside/through',
    '  the geometry. If any frame is mostly white or washed out, lower bloom (0.8–1.4) and',
    '  push the camera back (closest approach z >= 14) so the scene reads as glowing shapes.',
    '- Text that is unreadable: low contrast against the 3D, missing/weak scrim, headings',
    '  lost in the glow. Every text block visible in a frame must be crisply legible.',
    '- An empty, dead, or black hero: the 0% frame must already show the signature 3D world',
    '  plus the business name and promise — not a blank void waiting to load.',
    '- Broken mobile: overflow, cramped or overlapping text, a hero that collapses, the',
    '  preview banner overlapping content. The 390px frame must look intentional.',
    '- Concept mismatch: the shapes on screen do not evoke THIS trade (see the CONCEPT comment).',
    '- Flat / generic frames: if it looks like a plain brochure rather than a cinematic',
    '  immersive scene, rebuild the immersion using the recipes.',
    '- Runtime errors: if a RENDER DIAGNOSTICS section below lists JavaScript/console errors',
    '  or reports that the 3D canvas did not initialise, FIX EVERY ONE first — they mean the',
    '  scene is broken or half-rendered, which no amount of visual polish can compensate for.',
    'If a frame looks broken, that is the FIRST thing to fix — a beautiful codebase that',
    'renders as a white rectangle is a failure. Prioritise fixes by what the eyes see.',
    '',
  ] : [];
  return [
    'You are a senior art director and front-end lead reviewing a cinematic WebGL landing page before it is sent to a paying prospect.',
    'You receive a complete HTML landing page' + (hasFrames ? ' AND screenshots of it rendered' : '') + '. Critique it hard against the rubric below, then RETURN AN IMPROVED, COMPLETE HTML document.',
    '',
    ...visual,
    '═══ REVIEW RUBRIC (check each, fix every violation) ═══',
    '',
    '1. IMMERSION — is it a true full-page 3D experience (fixed WebGL canvas, scroll-driven camera chapters, bloom glow), or a flat page with a decorative header? If the latter, rebuild it as the former using the recipes below.',
    '2. CONCEPT COHERENCE — read the <!-- CONCEPT --> comment at the top. Does the 3D actually visualize THIS business\'s flagship offering (hologram silhouette, strand shape, centrepiece), or is it generic decoration? If generic, re-theme the shapes to the concept. Does each chapter pair a real service with its camera move? If a scan/HUD overlay (RECIPE H) was used on a warm/casual trade (restaurant, salon, cafe), remove it — it only belongs on precision/tech-coded trades.',
    '3. LEGIBILITY & EXPOSURE — every text block sits on a scrim with text-shadow and stays readable at EVERY scroll position; bloom strength within 0.8-1.6; the camera never passes inside geometry (no white-out frames).',
    '4. 3D CORRECTNESS — Three.js r128 API only (no CapsuleGeometry, no THREE.Geometry); one renderer; geometry created once, never in animate(); composer.render() when bloom is used; WebGL + prefers-reduced-motion guards with a CSS fallback; resize updates camera, renderer AND composer. If the page loads Vanta.js, particles.js, or any pre-built effect library, REMOVE it and rebuild the effect from the recipes.',
    '5. SVG ARTWORK — every service/feature card uses a custom SVG icon via <path>, NOT a unicode character (◈ ◆ ◉ ✦ ▸ ● ■) and NOT an emoji; replace any you find with hand-drawn SVG icons relevant to that service. SVGs use gradients, filters, or animation — not flat single-colour shapes.',
    '6. LANGUAGE CONSISTENCY — all visible text in ONE language matching the business content. If the business content is Dutch, every heading, button, section tag, and label must be Dutch — no "Our Services" or "Get In Touch" on a Dutch page. Fix any mixed-language text.',
    '7. MOTION QUALITY & ALIVE-ON-LOAD — the scene MUST visibly move the instant it loads, with NO scroll and NO mouse input: continuous ambient rotation/drift/bloom-breathing per the AMBIENT MOTION recipe. If the only motion is scroll-driven or mouse-parallax (i.e. it sits still on load), ADD ambient motion in animate() — this is the most common failure. Camera: scrubbed timeline, eased follow; content reveals on scroll; nothing janky.',
    '8a. EDITORIAL WORD LEGIBILITY — if a giant display word is used, it MUST be clearly visible on the dark background (bright outlined stroke or a light/accent fill at >=0.5 opacity). If it is a dark-on-dark, barely-visible watermark, FIX IT: brighten the stroke/fill and raise opacity until it reads as an intentional poster word.',
    '8b. LAYOUT VARIETY — if chapters are mostly centred stacks or look repetitive/templated, REBUILD them with distinct layouts (asymmetric hero, offset columns, bento, timeline, stat band, staggered cards). No two consecutive chapters share a layout; at most one centred stack total.',
    '8. HIERARCHY, BRAND & COPY — clear type-scale contrast; deliberate spacing rhythm; max 2 accent colours plus neutrals; hover states and focus rings on interactive elements; copy specific to this business — kill generic filler ("Quality You Can Trust", "We are committed to excellence").',
    '9. TECHNICAL — fully responsive 375px-1440px with no horizontal scroll and reduced particle counts on mobile; NO external image/photo files (only CSS/SVG/canvas/logo); cursor:pointer on clickables; prefers-reduced-motion respected; valid, complete, not truncated.',
    '',
    'A UX CHECKLIST follows the HTML — verify each item.',
    '',
    threeRecipes(),
    '',
    'OUTPUT RULES: Output ONLY the improved HTML document. Start with <!DOCTYPE html>, end with </html>. No markdown, no commentary.',
    'Keep what already works; raise everything else. The page should look like it was designed',
    'by a different, better agency than the one that made the input — not a minor tweak.',
  ].join('\n');
}

// Format render diagnostics (runtime errors + canvas health) for the repair
// pass. Empty string when the page wasn't rendered (Browser Rendering off).
function renderReport(diag) {
  if (!diag || !diag.rendered) return '';
  const lines = ['', 'RENDER DIAGNOSTICS (from actually running this HTML in a headless browser):'];
  if (!diag.canvasOk) {
    lines.push('- ⚠ The 3D <canvas> did NOT initialise — the WebGL scene is missing or the script threw ' +
      'before creating the renderer. Fix this FIRST: the page must render its cinematic scene, not a blank background.');
  }
  if (diag.errors && diag.errors.length) {
    lines.push('- ⚠ JavaScript/console errors captured at runtime — FIX EVERY ONE (they usually mean the scene is broken):');
    for (const e of diag.errors) lines.push('    • ' + e);
  }
  if (diag.canvasOk && (!diag.errors || !diag.errors.length)) {
    lines.push('- No runtime errors and the 3D canvas initialised cleanly. Focus on visual/aesthetic refinement from the screenshots.');
  }
  return lines.join('\n');
}

function businessBlock(place, branding, scraped) {
  const parts = ['BUSINESS:'];
  parts.push(`- Name: ${place.name || '(unknown)'}`);
  if (place.category) parts.push(`- Category: ${place.category}`);
  if (place.address) parts.push(`- Address: ${place.address}`);
  if (place.phone) parts.push(`- Phone: ${place.phone}`);
  if (place.website) parts.push(`- Website: ${place.website}`);
  if (place.rating) parts.push(`- Google rating: ${place.rating}★ (${place.total_ratings || 0} reviews)`);
  if (branding && (branding.logoUrl || (branding.colors && branding.colors.length))) {
    parts.push('', 'BRAND:');
    if (branding.logoUrl) parts.push(`- Logo URL (you may use as <img>): ${branding.logoUrl}`);
    if (branding.colors && branding.colors.length) {
      parts.push(`- Brand colours (extracted from the real logo — these are the ACTUAL brand identity):`);
      parts.push(`  ${branding.colors.join(', ')}`);
      parts.push(`  ANCHOR the palette to these: adapt the dominant brand colour into the glow/accent of the`);
      parts.push(`  dark cinematic scene, and echo a secondary brand colour, instead of defaulting to a generic`);
      parts.push(`  candidate palette. The candidate palettes below are references for structure/contrast only.`);
    }
  }
  parts.push('', 'SCRAPED WEBSITE CONTENT (may be empty or noisy — extract what is useful):');
  parts.push(scraped ? scraped.slice(0, 6000) : '(nothing scraped — design from the business name, category and city)');
  return parts.join('\n');
}

// ── Anthropic streaming call (raw HTTP SSE; returns assembled text) ──────────
// `frames` (optional) is an array of { label, data(base64 jpeg) } — when present
// they are attached as image blocks before the text so the model critiques what
// it can SEE, not just the code.
async function callClaudeStream(env, system, userText, frames, maxTokens) {
  let content;
  if (frames && frames.length) {
    content = [];
    for (const f of frames) {
      content.push({ type: 'text', text: `Screenshot — ${f.label}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } });
    }
    content.push({ type: 'text', text: userText });
  } else {
    content = userText;
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens || MAX_TOKENS,
      stream: true,
      output_config: { effort: 'high' },
      system,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', out = '', stop = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let ev; try { ev = JSON.parse(data); } catch { continue; }
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') out += ev.delta.text;
      else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
    }
  }
  if (stop === 'refusal') throw new Error('Model refused this request.');
  return out;
}

// Pull a clean HTML document out of the model's text (handles any stray preamble/fences)
function extractHtml(t) {
  if (!t) return '';
  let s = t.search(/<!doctype html/i);
  if (s < 0) s = t.search(/<html[\s>]/i);
  const e = t.toLowerCase().lastIndexOf('</html>');
  if (s >= 0 && e > s) return t.slice(s, e + 7).trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence && /<html|<!doctype/i.test(fence[1])) return fence[1].trim();
  return t.trim();
}
function looksComplete(html) {
  return !!html && /<html[\s>]/i.test(html) && /<\/html>/i.test(html) && html.length > 1200;
}

// ── Scrape via Jina Reader ──────────────────────────────────────────────────
async function scrape(website) {
  if (!website) return '';
  try {
    const target = website.startsWith('http') ? website : 'https://' + website;
    const r = await fetch('https://r.jina.ai/' + target, {
      headers: { 'x-respond-with': 'markdown' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return '';
    return (await r.text()) || '';
  } catch { return ''; }
}

// ── CORS / JSON helpers ─────────────────────────────────────────────────────
function withCors(resp) {
  const h = new Headers(resp.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  h.set('Access-Control-Allow-Headers', 'content-type');
  return new Response(resp.body, { status: resp.status, headers: h });
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
    // Diagnostic: GET the Worker URL in a browser to confirm the secret is bound.
    if (request.method === 'GET') return withCors(json({
      ok: true,
      hasKey: !!env.ANTHROPIC_API_KEY,
      keyLength: (env.ANTHROPIC_API_KEY || '').length,
      keyPrefix: (env.ANTHROPIC_API_KEY || '').slice(0, 8),
    }));
    if (request.method !== 'POST') return withCors(json({ error: 'POST only' }, 405));
    if (!env.ANTHROPIC_API_KEY) return withCors(json({ error: 'Worker missing ANTHROPIC_API_KEY secret' }, 500));

    let body;
    try { body = await request.json(); } catch { return withCors(json({ error: 'Invalid JSON body' }, 400)); }
    const place = body.place || {};
    const branding = body.branding || null;
    if (!place.name) return withCors(json({ error: 'place.name is required' }, 400));

    try {
      const scraped = await scrape(place.website);
      const ctx = businessBlock(place, branding, scraped);
      // Curated design intelligence (palettes/fonts/patterns/styles) matched to
      // the business type — extracted from the ui-ux-pro-max skill data.
      const brief = designBrief(place, branding);
      // Worked concept exemplar matched to the same domain the brief uses — a
      // few-shot taste anchor for the strategic decisions (offering, feeling,
      // 3D story, chapters) before any code is written.
      const domain = classifyDomain(
        [place.name, place.category, branding && (branding.notes || '')].filter(Boolean).join(' ')
      );
      const exemplar = exemplarBlock(domain);

      // CONCEPT pass — lock the strategy first (small, cheap, strategy-only).
      let conceptBriefText = '';
      try {
        const concept = extractJson(await callClaudeStream(
          env, conceptSystem(),
          ctx + '\n\n' + brief + '\n\n' + exemplar +
            '\n\nNow decide the concept. Output only the JSON object.',
          null, 2000
        ));
        conceptBriefText = conceptBrief(concept);
      } catch { /* concept pass optional — build pass still does STEP 1-3 itself */ }

      // DESIGN / BUILD pass — builds to the locked concept when we have one.
      const buildText = conceptBriefText
        ? ctx + '\n\n' + brief + '\n\n' + conceptBriefText + '\n\nNow build the complete website to this concept.'
        : ctx + '\n\n' + brief + '\n\n' + exemplar + '\n\nNow build the complete website.';
      let html = extractHtml(await callClaudeStream(env, designSystem(), buildText));
      if (!looksComplete(html)) throw new Error('Design pass produced incomplete HTML.');

      // ITERATIVE RENDER → REVIEW LOOP — the pattern agentic site builders use:
      // render the page, capture frames AND runtime errors, let the art director
      // fix what it sees plus any errors, then RE-RENDER to verify. Stops early
      // once a render is clean; capped at MAX_REVIEWS fix passes to bound cost.
      // When Browser Rendering is off it collapses to a single text-only review.
      const MAX_REVIEWS = 2;
      let frames = [], reviews = 0;
      let diag = { frames: [], errors: [], canvasOk: true, rendered: false };
      for (let i = 0; i <= MAX_REVIEWS; i++) {
        try { diag = await captureFrames(env, html); }
        catch { diag = { frames: [], errors: [], canvasOk: true, rendered: false }; }
        frames = diag.frames;
        const clean = diag.canvasOk && (!diag.errors || diag.errors.length === 0);
        if (i > 0 && clean) break;        // already fixed once and now renders clean → done
        if (i === MAX_REVIEWS) break;     // out of fix budget; return the last render's HTML
        try {
          const reviewed = extractHtml(await callClaudeStream(
            env, reviewSystem(frames.length > 0),
            businessBlock(place, branding, scraped) + '\n\n' + qaChecklist() +
              renderReport(diag) + '\n\nHTML TO IMPROVE:\n' + html,
            frames
          ));
          if (looksComplete(reviewed) && reviewed.length > html.length * 0.6) html = reviewed;
          reviews++;
        } catch { break; /* keep last good html */ }
        if (!diag.rendered) break;        // can't verify without rendering → one review only
      }

      return withCors(json({
        html, scrapedChars: scraped.length,
        framesSeen: frames.length, conceptLocked: !!conceptBriefText,
        reviewRounds: reviews,
        renderClean: diag.canvasOk && (!diag.errors || diag.errors.length === 0),
        renderErrors: (diag.errors || []).length,
      }));
    } catch (err) {
      return withCors(json({ error: String((err && err.message) || err) }, 502));
    }
  },
};
