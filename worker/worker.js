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
    'You are an award-winning creative web designer and front-end developer. You build the kind of bespoke marketing sites a top agency charges thousands for.',
    'Produce a COMPLETE, self-contained, single-file HTML5 landing page for the specific local business described by the user.',
    '',
    'OUTPUT RULES (critical):',
    '- Output ONLY the HTML document. Start with <!DOCTYPE html> and end with </html>.',
    '- No markdown, no code fences, no commentary before or after.',
    '',
    'BUILD RULES:',
    '- Self-contained: all CSS in a <style> tag, all JS in a <script> tag.',
    '- You MAY use CDN <link>/<script> for Google Fonts, GSAP (+ScrollTrigger), Lenis (smooth scroll), and Three.js (WebGL).',
    '- Create ONE signature 3D scroll moment with Three.js when it suits the brand: a procedural, asset-free WebGL scene (e.g. a drifting particle/point field, flowing light strands, a morphing wireframe form, or a wave surface) that reacts to scroll position via GSAP ScrollTrigger. Keep it abstract and generated from math — do NOT attempt photo-based effects (no source images exist). This is the main "wow".',
    '- 3D must degrade gracefully: guard WebGL with a try/catch and a feature check, disable the heavy scene under prefers-reduced-motion and on small/low-power screens (fall back to a CSS gradient/SVG), cap the device pixel ratio, and dispose/throttle so it stays smooth. Never let a failed 3D scene blank the page.',
    '- DO NOT reference any external image or photo files — none exist. Create every visual with CSS gradients, CSS shapes, SVG, or <canvas>. You may use the business LOGO URL if one is provided (as an <img>).',
    '- Treat hand-crafted inline SVG as your primary illustration medium — this is how you create rich imagery without photos. Draw bespoke hero artwork, abstract scenes, decorative background patterns, and custom trade-specific iconography (e.g. a stylised tooth for a dentist, a wrench for a garage, scissors for a salon). Use SVG gradients, filters (blur/glow), blend modes, masks, and subtle SVG/GSAP animation so the art feels designed and alive, not like plain coloured boxes.',
    '- Ground all content in the scraped website: real service names, real tone, real city. No lorem ipsum, no generic filler like "Quality You Can Trust".',
    '- Use the provided brand colours if any; otherwise choose a palette that suits the trade and mood.',
    '- Make it feel alive and high-end: a hero with motion, scroll-reveal animations, hover states, smooth transitions, a sticky/blurred nav, and a confident type scale. Tasteful, purposeful — never gaudy.',
    '- Include the sections that fit this business: hero, services/offerings, a why-us or stats band, testimonials, about, a contact section with a (non-functional) form, and a footer.',
    '- Fully mobile-responsive with accessible colour contrast.',
    '- Add a fixed top banner reading: "Website Preview — concept mockup for <business name>" so it is clearly a preview (offset the page so the banner does not overlap content).',
    '',
    'Aim for a design that makes the business owner think "I want this".',
  ].join('\n');
}

function reviewSystem() {
  return [
    'You are a senior art director and front-end lead reviewing a landing page before it is sent to a paying prospect.',
    'You receive a complete HTML landing page. Critique it hard against this rubric, then RETURN AN IMPROVED, COMPLETE HTML document:',
    '1. Bespoke vs generic — does it look custom-designed for THIS business, or like a template? Elevate weak areas.',
    '2. Visual hierarchy & polish — type scale, spacing, rhythm, colour use, depth. Make it feel premium.',
    '3. Animation with purpose — motion should guide the eye, not distract. Fix anything janky or gratuitous.',
    '4. Brand & copy — colours consistent; copy specific to this business and genuinely persuasive.',
    '5. Technical — fully responsive; NO external image/photo files (only CSS/SVG/canvas/logo); valid, complete, not truncated.',
    '',
    'OUTPUT RULES: Output ONLY the improved HTML document. Start with <!DOCTYPE html>, end with </html>. No markdown, no commentary.',
    'Keep what already works; raise everything else.',
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
