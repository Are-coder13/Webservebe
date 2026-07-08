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

import { designBrief, qaChecklist } from './design-knowledge.js';
import { threeRecipes } from './three-recipes.js';

// Model choice is a latency corner, measured across three live failures:
// the platform hard-kills the request at ~318s total, we run TWO sequential
// passes (design + art-director), and a full cinematic page needs >12k
// output tokens (a 12k ceiling truncated mid-page — "incomplete HTML").
// Opus 4.8 can't produce that many tokens twice inside 318s; Sonnet 5 is the
// faster tier with near-Opus coding quality and supports the same
// output_config.effort levels, so it's the tier that fits both constraints.
const MODEL = 'claude-sonnet-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
// 24k gives real headroom over the observed >12k need; adaptive thinking
// (on by default for this model) also counts toward max_tokens.
const MAX_TOKENS = 24000;
const EFFORT = 'medium';
const CALL_TIMEOUT_MS = 170000; // per-call cap; two sequential passes stay under the ~318s platform ceiling

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
    '- HARD SIZE BUDGET: the complete document must stay under ~70KB. Write dense, non-repetitive CSS (group shared rules, no restated boilerplate per section), lean JS, and no explanatory comments beyond the CONCEPT block. Running out of budget mid-file is a total failure — compact code is not optional.',
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
    '- Follow the tested recipes below for ALL Three.js code. They are proven to render correctly — adapt parameters and shapes creatively, but keep the architecture, guards, and API usage exactly as shown. DO NOT use Vanta.js, particles.js, or any other pre-built background effect library.',
    '- Within chapters, vary the content layout (offset columns, bento, timeline, icon-left rows — not always centred stacks), and keep the bespoke SVG iconography rules above.',
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
    '- Editorial poster moments: at 1-2 chapters, set a single giant display word (10-18vw, heavyweight, brand colour or outlined text) BEHIND the 3D/content layer, product-film style. It must relate to the trade (e.g. FRESH, PRECISION, SHINE) and stay partially cropped/clipped for tension.',
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

function reviewSystem() {
  return [
    'You are a senior art director and front-end lead reviewing a cinematic WebGL landing page before it is sent to a paying prospect.',
    'You receive a complete HTML landing page. Critique it hard against the rubric below, then RETURN AN IMPROVED, COMPLETE HTML document.',
    '',
    '═══ REVIEW RUBRIC (check each, fix every violation) ═══',
    '',
    '1. IMMERSION — is it a true full-page 3D experience (fixed WebGL canvas, scroll-driven camera chapters, bloom glow), or a flat page with a decorative header? If the latter, rebuild it as the former using the recipes below.',
    '2. CONCEPT COHERENCE — read the <!-- CONCEPT --> comment at the top. Does the 3D actually visualize THIS business\'s flagship offering (hologram silhouette, strand shape, centrepiece), or is it generic decoration? If generic, re-theme the shapes to the concept. Does each chapter pair a real service with its camera move? If a scan/HUD overlay (RECIPE H) was used on a warm/casual trade (restaurant, salon, cafe), remove it — it only belongs on precision/tech-coded trades.',
    '3. LEGIBILITY & EXPOSURE — every text block sits on a scrim with text-shadow and stays readable at EVERY scroll position; bloom strength within 0.8-1.6; the camera never passes inside geometry (no white-out frames).',
    '4. 3D CORRECTNESS — Three.js r128 API only (no CapsuleGeometry, no THREE.Geometry); one renderer; geometry created once, never in animate(); composer.render() when bloom is used; WebGL + prefers-reduced-motion guards with a CSS fallback; resize updates camera, renderer AND composer. If the page loads Vanta.js, particles.js, or any pre-built effect library, REMOVE it and rebuild the effect from the recipes.',
    '5. SVG ARTWORK — every service/feature card uses a custom SVG icon via <path>, NOT a unicode character (◈ ◆ ◉ ✦ ▸ ● ■) and NOT an emoji; replace any you find with hand-drawn SVG icons relevant to that service. SVGs use gradients, filters, or animation — not flat single-colour shapes.',
    '6. LANGUAGE CONSISTENCY — all visible text in ONE language matching the business content. If the business content is Dutch, every heading, button, section tag, and label must be Dutch — no "Our Services" or "Get In Touch" on a Dutch page. Fix any mixed-language text.',
    '7. MOTION QUALITY — scrubbed camera timeline with eased follow + mouse parallax; chapter content reveals on scroll; transitions 150-300ms; nothing janky or gratuitous.',
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
    if (branding.colors && branding.colors.length) parts.push(`- Brand colours: ${branding.colors.join(', ')}`);
  }
  parts.push('', 'SCRAPED WEBSITE CONTENT (may be empty or noisy — extract what is useful):');
  parts.push(scraped ? scraped.slice(0, 6000) : '(nothing scraped — design from the business name, category and city)');
  return parts.join('\n');
}

// ── Anthropic streaming call (raw HTTP SSE; returns assembled text) ──────────
async function callClaudeStream(env, system, userText) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      output_config: { effort: EFFORT },
      system,
      messages: [{ role: 'user', content: userText }],
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
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
  if (stop === 'max_tokens') throw new Error('Output hit the token limit and was truncated — raise MAX_TOKENS in the worker.');
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

      // DESIGN pass
      let html = extractHtml(await callClaudeStream(
        env, designSystem(),
        ctx + '\n\n' + brief + '\n\nNow build the complete website.'
      ));
      if (!looksComplete(html)) throw new Error('Design pass produced incomplete HTML.');

      // ART-DIRECTOR review/refine pass
      try {
        const reviewed = extractHtml(await callClaudeStream(
          env, reviewSystem(),
          businessBlock(place, branding, scraped) + '\n\n' + qaChecklist() +
            '\n\nHTML TO IMPROVE:\n' + html
        ));
        if (looksComplete(reviewed) && reviewed.length > html.length * 0.6) html = reviewed;
      } catch { /* keep design-pass HTML if review fails */ }

      return withCors(json({ html, scrapedChars: scraped.length }));
    } catch (err) {
      return withCors(json({ error: String((err && err.message) || err) }, 502));
    }
  },
};
