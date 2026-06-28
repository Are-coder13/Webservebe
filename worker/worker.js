/**
 * Prospector design agent — Cloudflare Worker
 *
 * Holds the Anthropic API key server-side (never exposed to the public
 * prospector.html on GitHub Pages). For each prospect it:
 *   1. Scrapes the prospect's real website via Jina Reader (JS-rendered markdown)
 *   2. DESIGN pass  — Claude acts as an expert creative web designer and produces
 *      a structured design spec grounded in the scraped content + brand
 *   3. REVIEW pass  — Claude acts as a senior design director, critiques the spec
 *      against a rubric, and returns an improved spec
 * and returns the final spec as JSON for prospector.html to render.
 *
 * Deploy: see README.md in this folder.
 */

const MODEL = 'claude-opus-4-8';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Curated, render-safe vocabularies. The agent may only pick from these, so the
// renderer in prospector.html never receives an unknown font/effect/layout/icon.
const LAYOUTS = ['centered', 'split', 'editorial', 'minimal'];
const FONT_PAIRS = [
  'Playfair Display + Inter',
  'Sora + Inter',
  'Space Grotesk + Inter',
  'Cormorant Garamond + Nunito Sans',
  'Poppins',
  'Raleway + Inter',
  'DM Serif Display + DM Sans',
];
const VANTA_EFFECTS = ['NET', 'WAVES', 'FOG', 'GLOBE', 'none'];
const ICONS = ['◈', '✦', '◉', '◆', '◇', '✧', '❖', '⬡'];

// ── JSON schema the agent must fill (structured outputs) ────────────────────
const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    layout: { type: 'string', enum: LAYOUTS,
      description: 'centered=bold full-bleed hero; split=hero text + glass logo card; editorial=oversized serif headline, asymmetric; minimal=light background, no 3D, calm.' },
    fontPair: { type: 'string', enum: FONT_PAIRS },
    vantaEffect: { type: 'string', enum: VANTA_EFFECTS,
      description: 'Animated 3D hero background. Use "none" for the minimal layout or calm brands.' },
    palette: {
      type: 'object', additionalProperties: false,
      properties: {
        primary: { type: 'string', description: 'Dark brand colour, hex e.g. #0a1628' },
        accent: { type: 'string', description: 'Vibrant accent, hex' },
        accentLight: { type: 'string', description: 'Very light tint of accent for section backgrounds, hex' },
        bg: { type: 'string', description: 'CSS linear-gradient for dark hero/stats/cta sections' },
      },
      required: ['primary', 'accent', 'accentLight', 'bg'],
    },
    hero: {
      type: 'object', additionalProperties: false,
      properties: {
        badge: { type: 'string', description: 'Small uppercase eyebrow, e.g. "Family Dentistry · Antwerp"' },
        headline: { type: 'string', description: 'The big H1. Specific to THIS business, not generic.' },
        subhead: { type: 'string', description: 'One or two sentences. Concrete, benefit-led, derived from their real services.' },
        ctaPrimary: { type: 'string' },
        ctaSecondary: { type: 'string' },
      },
      required: ['badge', 'headline', 'subhead', 'ctaPrimary', 'ctaSecondary'],
    },
    sectionTag: { type: 'string', description: 'Eyebrow for the services section, e.g. "What We Offer"' },
    services: {
      type: 'array',
      description: '3 to 4 real services this business offers, from the scraped site when available.',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          icon: { type: 'string', enum: ICONS },
          name: { type: 'string' },
          desc: { type: 'string', description: 'One or two specific sentences.' },
        },
        required: ['icon', 'name', 'desc'],
      },
    },
    stats: {
      type: 'array',
      description: 'Exactly 3 trust stats. Use real numbers from the site if present, otherwise plausible ones (rating, review count, years).',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          n: { type: 'string', description: 'e.g. "4.8★", "500+", "15"' },
          l: { type: 'string', description: 'e.g. "Average Rating", "Happy Clients", "Years Experience"' },
        },
        required: ['n', 'l'],
      },
    },
    reviews: {
      type: 'array',
      description: '2 short testimonials. Reuse real review snippets from the scrape if present; otherwise write believable ones in the right voice for this trade.',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          q: { type: 'string' },
          a: { type: 'string', description: 'Attribution, e.g. "Sarah M." or "James, Verified Client"' },
        },
        required: ['q', 'a'],
      },
    },
    about: {
      type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string' },
        body: { type: 'string', description: 'Two or three sentences about the business, grounded in the scrape.' },
      },
      required: ['title', 'body'],
    },
    rationale: { type: 'string', description: 'One sentence: why these design choices fit this specific business.' },
  },
  required: ['layout', 'fontPair', 'vantaEffect', 'palette', 'hero', 'sectionTag', 'services', 'stats', 'reviews', 'about', 'rationale'],
};

// ── Prompts ─────────────────────────────────────────────────────────────────
function designSystem() {
  return [
    'You are an award-winning creative web designer who builds bespoke marketing sites for local businesses.',
    'You are given a real business, what was scraped from their existing website (may be empty), and their brand assets.',
    'Design a single tailored landing-page concept by filling the provided schema.',
    '',
    'Hard rules:',
    '- Ground EVERYTHING in the specific business. No filler like "Quality You Can Trust". Name their actual services, city, and specialities.',
    '- If scraped content exists, pull real service names, real copy, real testimonials, and real numbers from it.',
    '- Choose layout/font/effect/colours that fit the trade and brand mood (a law firm ≠ a tattoo studio ≠ a bakery).',
    '- If brand colours are provided, build the palette around them. Otherwise pick colours that suit the industry.',
    '- accentLight must be a near-white tint of the accent. bg must be a dark linear-gradient that complements primary.',
    '- Copy must be concrete and sales-driving — the goal is a mockup convincing enough that the owner wants to buy the real site.',
    '- Use the minimal layout (and vantaEffect "none") for calm/premium/wellness/professional brands; bolder layouts + effects for energetic trades.',
  ].join('\n');
}

function designUser(place, branding, scraped) {
  const parts = [];
  parts.push('BUSINESS:');
  parts.push(`- Name: ${place.name || '(unknown)'}`);
  if (place.category) parts.push(`- Category: ${place.category}`);
  if (place.address) parts.push(`- Address: ${place.address}`);
  if (place.phone) parts.push(`- Phone: ${place.phone}`);
  if (place.website) parts.push(`- Website: ${place.website}`);
  if (place.rating) parts.push(`- Google rating: ${place.rating}★ (${place.total_ratings || 0} reviews)`);
  parts.push('');
  if (branding && (branding.logoUrl || (branding.colors && branding.colors.length))) {
    parts.push('BRAND:');
    if (branding.logoUrl) parts.push(`- Logo available: yes`);
    if (branding.colors && branding.colors.length) parts.push(`- Brand colours: ${branding.colors.join(', ')}`);
    parts.push('');
  }
  parts.push('SCRAPED WEBSITE CONTENT (may be empty or noisy — extract what is useful):');
  parts.push(scraped ? scraped.slice(0, 6000) : '(nothing scraped — design from the business name, category and city)');
  parts.push('');
  parts.push('Now produce the design spec.');
  return parts.join('\n');
}

function reviewSystem() {
  return [
    'You are a senior design director reviewing a junior designer\'s landing-page concept before it is sent to a paying prospect.',
    'You are given the business context and the proposed design spec (as JSON).',
    'Critique it hard against this rubric, then RETURN AN IMPROVED spec in the same schema:',
    '1. Specificity — is every line clearly about THIS business, or is there generic filler? Replace filler with concrete, trade-specific copy.',
    '2. Sales pull — would the owner read the hero and think "I want this"? Sharpen the headline and subhead.',
    '3. Brand fit — do layout, fonts, effect and palette suit this trade and the brand colours? Fix mismatches.',
    '4. Coherence — accentLight is a light tint of accent; bg is a dark gradient matching primary; contrast is legible.',
    '5. Believability — services/stats/reviews read as real, not invented boilerplate.',
    'Keep what already works. Only change what improves it. Return the full improved spec.',
  ].join('\n');
}

function reviewUser(place, spec) {
  return [
    `BUSINESS: ${place.name || ''}${place.category ? ' — ' + place.category : ''}${place.address ? ' (' + place.address + ')' : ''}`,
    '',
    'PROPOSED SPEC:',
    JSON.stringify(spec, null, 2),
    '',
    'Return the improved spec.',
  ].join('\n');
}

// ── Anthropic call (raw HTTP; structured output) ────────────────────────────
async function callClaude(env, system, userText) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system,
      output_config: { format: { type: 'json_schema', schema: DESIGN_SCHEMA } },
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('Model refused this request.');
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text block in Anthropic response.');
  return JSON.parse(textBlock.text);
}

// ── Scrape via Jina Reader (renders JS, returns clean markdown, CORS-free) ──
async function scrape(website) {
  if (!website) return '';
  try {
    const target = website.startsWith('http') ? website : 'https://' + website;
    const r = await fetch('https://r.jina.ai/' + target, {
      headers: { 'x-respond-with': 'markdown' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return '';
    const md = await r.text();
    return md || '';
  } catch {
    return '';
  }
}

// ── CORS helpers ────────────────────────────────────────────────────────────
function withCors(resp) {
  const h = new Headers(resp.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'content-type');
  return new Response(resp.body, { status: resp.status, headers: h });
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));
    if (request.method !== 'POST') return withCors(json({ error: 'POST only' }, 405));
    if (!env.ANTHROPIC_API_KEY) return withCors(json({ error: 'Worker missing ANTHROPIC_API_KEY secret' }, 500));

    let body;
    try { body = await request.json(); } catch { return withCors(json({ error: 'Invalid JSON body' }, 400)); }
    const place = body.place || {};
    const branding = body.branding || null;
    if (!place.name) return withCors(json({ error: 'place.name is required' }, 400));

    try {
      const scraped = await scrape(place.website);
      const design = await callClaude(env, designSystem(), designUser(place, branding, scraped));
      const reviewed = await callClaude(env, reviewSystem(), reviewUser(place, design));
      return withCors(json({ spec: reviewed, scrapedChars: scraped.length }));
    } catch (err) {
      return withCors(json({ error: String(err && err.message || err) }, 502));
    }
  },
};
