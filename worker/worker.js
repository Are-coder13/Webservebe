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
    'HERO SECTION — the "wow" moment:',
    '- Make each hero structurally different. Vary the layout across these approaches:',
    '  (a) Full-width centred headline over an animated SVG background scene,',
    '  (b) Split layout — text left, large SVG illustration right,',
    '  (c) Asymmetric overlap — headline offset with floating SVG elements and CSS shapes,',
    '  (d) Editorial — large type with an SVG accent illustration bleeding into a gradient.',
    '- A subtle animated accent (CSS @keyframes preferred over heavy JS) adds premium feel:',
    '  floating particles via CSS, a morphing blob via SVG animate, a gradient shift, or a',
    '  parallax layer. These are lightweight and work everywhere.',
    '- You MAY use a custom Three.js procedural scene (particles, wave mesh, flowing lines)',
    '  ONLY if you write it from scratch (not Vanta.js or any prebuilt library). Guard it with',
    '  WebGL feature detection + try/catch, disable under prefers-reduced-motion, and fall back',
    '  to an SVG/CSS background. Cap devicePixelRatio at 1.5. If you are not confident you can',
    '  write a bug-free custom WebGL scene, use SVG + CSS animation instead — they are equally',
    '  impressive and more reliable.',
    '- DO NOT use Vanta.js, particles.js, or any other pre-built background effect library.',
    '',
    'PAGE STRUCTURE — avoid the same skeleton every time:',
    '- DO NOT default to the same section order for every site. Study the business and pick',
    '  a structure that fits. A dental practice might lead with trust/credentials, a garage',
    '  with a clear service list, a beauty salon with an immersive visual experience.',
    '- Choose from the CANDIDATE LAYOUT PATTERNS provided in the design intelligence section.',
    '- Vary card layouts: masonry, bento grid, offset columns, timeline, or icon-left text-right',
    '  — not always a 3-column grid of identical cards.',
    '- Add at least one visual-break section: a full-bleed gradient band with a single stat,',
    '  an SVG illustration interlude, or a parallax-scrolling quote.',
    '',
    '═══ BUILD RULES ═══',
    '',
    '- Self-contained: all CSS in a <style> tag, all JS in a <script> tag.',
    '- You MAY use CDN <link>/<script> for Google Fonts and GSAP (+ScrollTrigger) only.',
    '- DO NOT reference any external image or photo files — none exist.',
    '  Create every visual with CSS gradients, CSS shapes, inline SVG, or <canvas>.',
    '  You may use the business LOGO URL if one is provided (as an <img>).',
    '- Ground all content in the scraped website: real service names, real tone, real city.',
    '  No lorem ipsum, no generic filler ("Quality You Can Trust", "Your satisfaction is our priority").',
    '',
    'LANGUAGE RULE (important):',
    '- Detect the language of the scraped website content. If it is Dutch, write ALL visible',
    '  text (headings, body, buttons, labels, section tags, CTA, footer) in Dutch.',
    '  If French, write in French. Only use English if the original site is in English',
    '  or no content was scraped. Never mix languages within a page.',
    '',
    '- Make it feel alive and high-end: scroll-reveal animations (GSAP ScrollTrigger),',
    '  hover states, smooth transitions (150–300ms), a sticky/blurred glass nav, and a',
    '  confident type scale. Tasteful, purposeful — never gaudy.',
    '- Fully mobile-responsive (375px, 768px, 1024px, 1440px breakpoints).',
    '- Add a fixed top banner: "Website Preview — concept mockup for <business name>".',
    '  Offset the page so the banner does not overlap content.',
    '- Use cursor:pointer on all clickable elements.',
    '- Respect prefers-reduced-motion: disable animations, parallax, and 3D under that media query.',
    '',
    'Aim for a design that makes the business owner think "I want this".',
  ].join('\n');
}

function reviewSystem() {
  return [
    'You are a senior art director and front-end lead reviewing a landing page before it is sent to a paying prospect.',
    'You receive a complete HTML landing page. Critique it hard against the rubric below, then RETURN AN IMPROVED, COMPLETE HTML document.',
    '',
    '═══ REVIEW RUBRIC (check each, fix every violation) ═══',
    '',
    '1. SVG ARTWORK (highest priority):',
    '   - Hero MUST have a substantial bespoke inline SVG illustration (not just a gradient box).',
    '   - Every service/feature card MUST use a custom SVG icon via <path>, NOT a unicode',
    '     character (◈ ◆ ◉ ✦ ▸ ● ■) and NOT an emoji. If you find unicode/emoji icons,',
    '     replace each one with a hand-drawn SVG icon relevant to that service.',
    '   - At least one SVG section divider or decorative element between sections.',
    '   - SVGs should use gradients, filters, or animation — not flat single-colour shapes.',
    '',
    '2. NO PRE-BUILT EFFECT LIBRARIES:',
    '   - If the page loads Vanta.js, particles.js, or similar, REMOVE the CDN script',
    '     and replace the effect with either custom-written Three.js (if you can write it',
    '     bug-free) or a CSS/SVG animated background. The goal is a bespoke result.',
    '',
    '3. LANGUAGE CONSISTENCY:',
    '   - All visible text must be in ONE language. If the business content is Dutch,',
    '     every heading, button, section tag, and label must be Dutch — no "Our Services"',
    '     or "Get In Touch" on a Dutch page. Fix any mixed-language text.',
    '',
    '4. STRUCTURAL VARIETY:',
    '   - Not every section should be the same pattern (dark hero → 3-col cards → stats → reviews → CTA → contact).',
    '   - At least one section should break from a symmetric grid: masonry, bento, timeline,',
    '     offset columns, or icon-left/text-right rows.',
    '',
    '5. VISUAL HIERARCHY & POLISH:',
    '   - Type scale should have clear contrast between heading, subhead, body, and caption sizes.',
    '   - Spacing rhythm should feel deliberate (consistent multiples of a base unit).',
    '   - Colour palette should be coherent — max 2 accent colours plus neutrals.',
    '   - Hover states, focus rings, and transitions (150–300ms) on all interactive elements.',
    '',
    '6. BRAND & COPY:',
    '   - Copy must be specific to this business. Kill any generic filler ("Quality You Can Trust",',
    '     "Your satisfaction is our priority", "We are committed to excellence").',
    '   - If there is scraped content, the page should reflect the real services and tone.',
    '',
    '7. TECHNICAL:',
    '   - Fully responsive (375px → 1440px). No horizontal scroll.',
    '   - NO external image/photo files (only CSS/SVG/canvas/logo). No broken image refs.',
    '   - Valid, complete, not truncated. cursor:pointer on clickable elements.',
    '   - prefers-reduced-motion respected.',
    '',
    'A UX CHECKLIST follows the HTML — verify each item.',
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
      output_config: { effort: 'high' },
      system,
      messages: [{ role: 'user', content: userText }],
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
