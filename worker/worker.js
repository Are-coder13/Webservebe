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
// 32k: the page is now a multi-VIEW single file (Home/About/Contact share one
// scene + chrome) with real imagery, so the document is larger. Chrome/CSS/scene
// are written once and shared across views, so the extra views add modest length.
// Adaptive thinking (on by default) also counts toward max_tokens.
const MAX_TOKENS = 32000;
// 'high' timed out: one 24k-token pass at high effort ran past 170s, and two
// of those blow the ~318s platform hard-kill. 'medium' still carries the
// 6-step brand reasoning but keeps each pass fast enough that both finish.
const EFFORT = 'medium';
// The whole Worker invocation is hard-killed by the platform around ~318s.
// Both passes must fit under this with margin, so we budget wall-clock time
// across them instead of giving each a fixed 170s (2×170 = 340 > 318).
const TOTAL_BUDGET_MS = 300000; // hard ceiling for both passes combined (safety margin under ~318s)
const DESIGN_TIMEOUT_MS = 210000; // the design pass is primary and must finish
const REVIEW_MIN_MS = 70000; // skip the review pass unless at least this much budget remains
const REVIEW_SAFETY_MS = 15000; // leave headroom under TOTAL_BUDGET_MS for parsing/response

// ── Prompts ─────────────────────────────────────────────────────────────────
function designSystem() {
  return [
    'You are an award-winning creative web designer and front-end developer.',
    'You build the kind of bespoke marketing sites a top agency charges thousands for.',
    'Produce a COMPLETE, self-contained, single-file HTML5 website for the specific local business described by the user. It is ONE .html file that contains MULTIPLE VIEWS (Home + About + Contact, and Services when the business warrants it) which the visitor switches between via an in-page nav — NOT a single landing page. See the MULTI-VIEW ARCHITECTURE section.',
    '',
    'OUTPUT RULES (critical):',
    '- Output ONLY the HTML document. Start with <!DOCTYPE html> and end with </html>.',
    '- No markdown, no code fences, no commentary before or after.',
    '- HARD SIZE BUDGET: the complete document must stay under ~100KB. The scene, CSS, nav and footer are written ONCE and shared across every view, so extra views cost little. Write dense, non-repetitive CSS (group shared rules, no restated boilerplate per section), lean JS, no explanatory comments beyond the CONCEPT block. Running out of budget mid-file is a total failure — compact code is not optional.',
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
    '- BRAND COLOURS COME FIRST. If the BUSINESS block lists brand colours, or the scraped site reveals a clear brand colour, THAT is your palette foundation — the site must visibly read as THIS brand. Build the whole colour system from those real colours (use them for the signature accent, key headings, buttons, glow/bloom tint, and 3D particle colours); you may derive supporting shades (a deeper base, a lighter tint, a complementary neutral) from them, but do not replace them with an unrelated palette. Only when NO real brand colour exists do you invent one from the trade and emotion.',
    '- The DESIGN INTELLIGENCE section below is a REFERENCE of curated palettes/fonts for this trade — treat it as inspiration for when the client has NO brand colours of their own, not a menu to override real brand colours with. A page that ignores the client\'s actual brand colours, or that looks like it picked option 3 from a list, has failed.',
    '- Commit to a distinctive type pairing with real personality (a characterful display face + clean body). Avoid the default-web trio Inter/Roboto/Arial for headings. Two typefaces maximum, loaded via Google Fonts.',
    '- Define the whole system as CSS custom properties in :root. Dark text on light backgrounds must meet 4.5:1 contrast (WCAG AA).',
    '',
    'THE EXPERIENCE — the whole page is the wow moment (a flat brochure will NOT sell):',
    '- Build an IMMERSIVE CINEMATIC page in the style of award-winning studio sites: ONE fixed full-viewport WebGL scene behind everything, with the content scrolling over it as "chapters" while a scroll-driven camera flies through the 3D world.',
    '- The 3D world is procedural and asset-free: a two-tone particle universe + a signature parametric light-strand + a glowing wireframe centrepiece, all glowing via UnrealBloom. Tune every colour to the brand palette; pick strand/centrepiece shapes that evoke the trade.',
    '- MOTION MUST BE BOLD AND CONSTANT — the #1 failure so far is a scene that barely moves. The 3D has to be alive and dramatic at ALL times, not a near-static backdrop. Non-negotiable:',
    '  • Continuous ambient motion every frame (RECIPE F2/G2): the universe and centrepiece visibly rotate, the flagship hologram (the tooth/gem/loaf) turns/shimmers/floats — obvious at rest, before any scroll. If a first glance looks frozen, you have failed.',
    '  • Big, weighty CAMERA travel across the scroll: real distance and angle change between chapters (e.g. z from ~46 down to ~14 and back out, sweeping orbit of 90–180°, a dive and a rise) — not a timid nudge. The viewer should feel they are flying THROUGH the world.',
    '  • A dramatic FLAGSHIP reveal: the particle cloud sweeps in and assembles into the hero silhouette (RECIPE G) as its chapter arrives — a real transformation, the emotional peak.',
    '  • Living particles: gentle per-point drift/wave and a bloom that pulses within 0.8–1.6 so the whole field breathes and sparkles.',
    '- Choreograph 4-6 camera chapters across the scroll (wide establish -> push-in -> sweeping orbit -> flagship reveal / close approach -> rise -> settle on CTA). Motion must feel weighty and smooth: scrubbed timeline + eased camera + mouse parallax, layered ON TOP of the always-on ambient motion.',
    '- Follow the tested recipes below for ALL Three.js code. They are proven to render correctly — adapt parameters and shapes creatively (push the amplitude of every move), but keep the architecture, guards, and API usage exactly as shown. DO NOT use Vanta.js, particles.js, or any other pre-built background effect library.',
    '- Within chapters, vary the content layout (offset columns, bento, timeline, icon-left rows — not always centred stacks), and keep the bespoke SVG iconography rules above.',
    '',
    'DESIGN PROCESS — think like a senior brand designer + creative director + copywriter working as one. Do ALL steps IN ORDER, in your reasoning, before any code. The concept is the product; the code is just delivery.',
    '',
    'STEP 1 — BRAND & MARKET STUDY. Read the scraped site, category, reviews, and location like a strategist. Extract: (a) CORE BUSINESS — what they truly sell and how they make money; (b) FLAGSHIP — the ONE product, service, or signature offering to build the whole page around (from a catalogue, pick the hero item; from a service firm, pick the signature service); (c) CUSTOMER & EMOTION — who buys and the feeling in play (fear, pride, appetite, trust, status, relief); (d) STORY & POSITIONING — origin, years, what makes them different from the competitor down the street; (e) BRAND VOICE — how they actually talk (warm/clinical/bold/artisanal), in their real language (Dutch/French/English — match it exactly).',
    'STEP 2 — BRAND REFRESH (anchored to their REAL colours). First, identify the client\'s actual brand colours: use the brand colours in the BUSINESS block if given, otherwise infer them from the scraped site (logo, headings, buttons). Those real colours are the NON-NEGOTIABLE starting point — the finished page must be recognisably THIS brand at a glance. You are elevating their look, not replacing their identity: keep their signature colour(s) as the leading accent, then build a refined system AROUND them (a deep on-brand base for the 3D chapters, one supporting tint or complementary neutral derived from the brand colour, matching bloom/particle tints). Only if the client has NO discernible brand colour at all do you compose a palette from the trade and the STEP 1 emotion (never generic blue-by-default). Also choose a striking type pairing with real personality (a distinctive display face + clean body — avoid Inter/Roboto/Arial defaults) and one recurring visual signature motif (a shape, a line treatment, a texture). Justify every choice by the brand and trade. The result must look like a top-tier studio rebrand of THIS brand — same identity, elevated — not a template reskin and not a different brand.',
    'STEP 3 — THE CORE-DRIVEN 3D CONCEPT. The 3D is the pitch for the FLAGSHIP, invented by LOGIC, not decoration. Reason explicitly: "What is the essence of this flagship, and what visual metaphor captures it?" — then design the scene around THAT. The particle system, the light-strand curve, the hologram silhouette (RECIPE G) and the centrepiece geometry (RECIPE D) should all evolve from the core offering and its feeling. Examples of the REASONING you must do: a bakery\'s flagship sourdough -> warm particles swirl and settle into a crusted loaf cross-section as copy talks slow fermentation; a solar installer -> light rays converge into a glowing panel grid; an accountant -> scattered figures snap into a balanced ledger/graph line climbing up; a jeweller -> facets of light refract and assemble a gem. Never reuse a generic shape you\'d give any client — derive it from THIS flagship.',
    'STEP 4 — STORYBOARD. Map 4-6 scroll chapters, each pairing ONE sharp message with ONE camera move, building toward the flagship reveal and the CTA: cinematic hero (name + the core promise, wide shot) -> the world/craft (push-in) -> THE FLAGSHIP REVEAL (the hologram forms, orbit — this is the emotional peak) -> proof (real stats/testimonials, close approach) -> an editorial poster beat -> CTA (settle on the booking/contact action). Name real offerings from the scrape in each chapter.',
    'STEP 5 — COPYWRITING (world-class). Write every visible word as a senior conversion copywriter for THIS brand, in THEIR language and voice. Headlines are specific and evocative, never generic ("Feilloos in balans" beats "Quality Accounting You Can Trust"). Kill all filler. Body copy sells the feeling and the outcome, grounded in real services and real proof. The CTA is a confident, specific action. Copy should sound expensively written — like the brand hired a great agency.',
    'STEP 5b — IMAGERY & VIEWS PLAN. Decide (a) which REAL client photos (IMG1, IMG2… from the BUSINESS block) go where across the views, and where you will instead craft rich imitation-SVG imagery; and (b) which views the business needs (always Home/About/Contact; add Services/Menu/Portfolio if they have a catalogue). The storyboard chapters above are the HOME view; About and Contact are shorter views on the same living backdrop. See HYBRID IMAGE POLICY and MULTI-VIEW ARCHITECTURE.',
    'STEP 6 — BUILD it with the recipes below, honouring the elevated brand system, the core-driven scene, the storyboard, the copy, the real imagery, and the multi-view structure.',
    'Record STEPS 1-5b as a short HTML comment immediately after <!DOCTYPE html> (max 16 lines): <!-- CONCEPT: core-business=..., flagship=..., emotion=..., brand-refresh(palette/type/motif)=..., 3d-metaphor=..., chapters=..., views=..., images=... -->. The art director verifies the scene, brand system, copy, imagery and views all serve the flagship.',
    '',
    threeRecipes(),
    '',
    '═══ BUILD RULES ═══',
    '',
    '- Self-contained: all CSS in a <style> tag, all JS in a <script> tag.',
    '- You MAY use CDN <link>/<script> for Google Fonts and the exact Three.js/GSAP scripts listed in the recipes, the LOGO URL, and the REAL PHOTO URLs listed in the BUSINESS block (per the HYBRID IMAGE POLICY). Nothing else.',
    '',
    '═══ HYBRID IMAGE POLICY (imagery, not just abstract shapes) ═══',
    '- USE THE CLIENT\'S REAL PHOTOS. When the BUSINESS block lists "REAL PHOTOS FROM THE CLIENT\'S OWN SITE" (IMG1, IMG2…), place them as real <img> in the content views — the hero/feature imagery, an About portrait or interior, a services gallery, a Contact map/storefront shot. Choose the ones that fit each spot; you need not use all. This is what makes it feel like THEIR real site, elevated.',
    '- MANDATORY FALLBACK on every reused photo, because a hotlinked URL may fail to load: give each <img> an onerror handler that hides it and reveals an on-brand CSS-gradient/SVG placeholder in its place — e.g. onerror="this.style.display=\'none\';this.parentNode.classList.add(\'imgfallback\')" with a .imgfallback::after gradient + a small inline-SVG motif. The layout must look intentional and beautiful even if every photo 404s. Add loading="lazy" and a fixed aspect-ratio box so nothing reflows.',
    '- IMITATE / UPGRADE where there is no usable photo: compose a rich, detailed inline SVG "image" that imitates what their real photo would show (a stylised clinic interior, a plated dish, a product hero, a portrait) — layered shapes, gradients, soft shadows, depth — clearly a crafted illustration, not a flat icon. Make it look BETTER than the original. This is the primary medium when NO real photos were scraped.',
    '- Treat photos and SVG as one art-directed system: consistent framing, rounded corners or the STEP 2 signature motif, duotone/brand-tinted overlays on photos so they harmonise with the palette and the 3D. Never dump a raw photo next to a cartoon icon.',
    '',
    '═══ MULTI-VIEW ARCHITECTURE (one file, several pages) ═══',
    '- Build a fixed top NAV (logo + links) with the views the business needs: always Home, About (Over ons / À propos), Contact; add Services/Menu/Portfolio when they have a clear catalogue or service list. Match the nav labels to the site\'s language.',
    '- Implement views as sections (<section data-view="home">, "about", "contact"…). Exactly one is visible at a time; clicking a nav link (and hash routing, e.g. #about) fades the current view out and the target in (200–350ms), scrolls to top, and sets the active nav state. Support back/forward via hashchange and honour the initial hash on load. No full reload, no external routing library — a few lines of vanilla JS.',
    '- The ONE fixed WebGL scene, the nav, and the footer persist across ALL views (shared chrome). Only the view\'s content swaps. The immersive scroll "chapters" live inside the HOME view; About and Contact are shorter but still sit on the same living 3D backdrop with the same design language.',
    '- ABOUT view: the real story/positioning from STEP 1 — origin, team, values, an About photo or crafted SVG portrait/interior, real stats. CONTACT view: real address, phone, hours, a (non-functional) contact/booking form, and a styled map placeholder or storefront image. SERVICES view (if used): the real catalogue with SVG-iconed cards and prices/details where known.',
    '- Keep the scroll-driven camera timeline scoped to the Home view (guard ScrollTrigger so switching views doesn\'t break it); the ambient motion keeps running on every view so the backdrop is always alive.',
    '- Editorial poster moments: at 1-2 chapters, set a single giant display word (10-18vw, heavyweight, brand colour or outlined text) BEHIND the 3D/content layer, product-film style. It must relate to the trade (e.g. FRESH, PRECISION, SHINE) and stay partially cropped/clipped for tension.',
    '- For product-led trades you may add an "exploded diagram" chapter: a layered inline SVG of the flagship product (5-8 stacked parts you draw yourself) whose parts translate apart on scroll (GSAP scrub), with thin leader lines labelling REAL services from the scrape.',
    '- For precision/tech-coded trades (dental, auto diagnostics, legal, security, medical, engineering — NOT restaurants/salons/cafes) you may frame the hologram moment (RECIPE G) with the scan/targeting HUD overlay (RECIPE H): corner brackets, reticle, scanline, and a small readout panel naming a real detail (a service, a precision stat) — fades in only while that hologram forms.',
    '- Ground all content in the scraped website: real service names, real tone, real city. No lorem ipsum, no generic filler ("Quality You Can Trust", "Your satisfaction is our priority").',
    '- The WebGL/bloom hero reads best on a deep, dark backdrop, so the hero and 3D chapters should sit on the brand\'s darkest tone. But the page is NOT obliged to be near-black throughout — if the STEP 2 brand refresh calls for warmth or light (a bakery, a salon, a boutique), let later chapters breathe with lighter, on-brand sections. Match the mood to the brand, not to a fixed dark template.',
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
    'You are a senior art director and front-end lead reviewing a cinematic WebGL multi-view website before it is sent to a paying prospect.',
    'You receive a complete single-file HTML site (Home/About/Contact views sharing one 3D scene). Critique it hard against the rubric below, then RETURN AN IMPROVED, COMPLETE HTML document.',
    '',
    '═══ REVIEW RUBRIC (check each, fix every violation) ═══',
    '',
    '1. IMMERSION — is it a true full-page 3D experience (fixed WebGL canvas, scroll-driven camera chapters, bloom glow), or a flat page with a decorative header? If the latter, rebuild it as the former using the recipes below.',
    '2. CONCEPT COHERENCE — read the <!-- CONCEPT --> comment. Is there a real flagship, and does the 3D metaphor genuinely derive from it (not a generic shape you\'d give any client)? If the scene is generic decoration, re-theme it so it visualizes THIS flagship. Does each chapter pair a real offering with its camera move? Remove a scan/HUD overlay (RECIPE H) if used on a warm/casual trade.',
    '2b. BRAND COLOURS & ELEVATION — if the business has real brand colours (see the BUSINESS block or the logo), does the page actually USE them as its leading palette so it reads as THIS brand? If the design ignored the real brand colours and invented an unrelated palette, RE-COLOUR it around the real brand colours (accent, key headings, buttons, bloom/particle tints), keeping supporting shades derived from them. Only a client with no brand colour at all may use a trade-inspired palette. Then check elevation: a deliberate colour story (not default blue), a distinctive display typeface (NOT Inter/Roboto/Arial for headings), and a recurring visual motif. If it reads generic or "safe", push type and supporting tones toward the brand\'s real personality — without abandoning its real colours. The brand must stand out AND be recognisable as itself.',
    '2c. COPYWRITING — is every headline specific and evocative in the brand\'s real voice and language, or is it filler? Rewrite weak/generic lines as a senior conversion copywriter for this brand. Kill "Quality You Can Trust"-tier phrases. The CTA must be a confident, specific action.',
    '3. LEGIBILITY & EXPOSURE — every text block sits on a scrim with text-shadow and stays readable at EVERY scroll position; bloom strength within 0.8-1.6; the camera never passes inside geometry (no white-out frames).',
    '4. 3D CORRECTNESS — Three.js r128 API only (no CapsuleGeometry, no THREE.Geometry); one renderer; geometry created once, never in animate(); composer.render() when bloom is used; WebGL + prefers-reduced-motion guards with a CSS fallback; resize updates camera, renderer AND composer. If the page loads Vanta.js, particles.js, or any pre-built effect library, REMOVE it and rebuild the effect from the recipes.',
    '5. SVG ARTWORK — every service/feature card uses a custom SVG icon via <path>, NOT a unicode character (◈ ◆ ◉ ✦ ▸ ● ■) and NOT an emoji; replace any you find with hand-drawn SVG icons relevant to that service. SVGs use gradients, filters, or animation — not flat single-colour shapes.',
    '6. LANGUAGE CONSISTENCY — all visible text in ONE language matching the business content. If the business content is Dutch, every heading, button, section tag, and label must be Dutch — no "Our Services" or "Get In Touch" on a Dutch page. Fix any mixed-language text.',
    '7. MOTION QUALITY, LIVENESS & DRAMA — CRITICAL and the most common failure: is the 3D genuinely alive and cinematic, or does it barely move? (a) ALIVE AT REST — before any scroll the universe/centrepiece visibly rotate and the flagship hologram (tooth/gem/loaf) turns/shimmers/floats every frame via a THREE.Clock (RECIPE F2/G2); if the only motion is scroll or mouse (frozen when still), ADD idle animation. (b) DRAMA — is the camera travel BOLD (big z and angle changes across chapters, a real fly-through), or a timid nudge? If the moves are small, increase their amplitude. (c) Is there a real flagship REVEAL where particles assemble into the hero shape? If missing or weak, build it. Also: scrubbed camera timeline with eased follow + parallax; chapter content reveals on scroll; transitions 150-300ms; nothing janky.',
    '8. HIERARCHY, BRAND & COPY — clear type-scale contrast; deliberate spacing rhythm; max 2 accent colours plus neutrals; hover states and focus rings on interactive elements; copy specific to this business — kill generic filler ("Quality You Can Trust", "We are committed to excellence").',
    '9. IMAGERY (hybrid policy) — does the site use real imagery, not just abstract shapes? If the BUSINESS block listed REAL PHOTOS (IMG1…), are they placed as <img> in the content views, EACH with an onerror gradient/SVG fallback + loading="lazy" + a fixed aspect-ratio box (so a dead URL degrades gracefully, no reflow)? Where there is no photo, is there a rich imitation-SVG "image" (layered, shaded, depth — not a flat icon)? Photos must be brand-tinted/framed to harmonise with the palette. Add fallbacks to any bare <img>, and upgrade any placeholder-looking imagery.',
    '10. MULTI-VIEW — is this a multi-view site (nav with Home/About/Contact, optional Services), not a single scroll page? Exactly one view visible at a time; nav + hash routing fade between views (200-350ms), scroll to top, set active state, honour back/forward and the initial hash; the WebGL scene, nav and footer persist across views; the scroll camera timeline is scoped to Home and does not break on view switch. If any of this is missing, add it. About = real story/team/stats; Contact = real address/phone/hours + form + map/storefront; Services = real catalogue when present.',
    '11. TECHNICAL — fully responsive 375px-1440px with no horizontal scroll and reduced particle counts on mobile; the only external assets are Google Fonts, the listed Three.js/GSAP, the logo, and the client\'s real photo URLs (each with a fallback); cursor:pointer on clickables; prefers-reduced-motion respected; valid, complete, not truncated.',
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

function businessBlock(place, branding, scraped, images) {
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
  if (images && images.length) {
    parts.push('', "REAL PHOTOS FROM THE CLIENT'S OWN SITE (reuse these as <img> per the HYBRID IMAGE POLICY — every one needs the onerror gradient fallback):");
    images.forEach((u, i) => parts.push(`- IMG${i + 1}: ${u}`));
  }
  parts.push('', 'SCRAPED WEBSITE CONTENT (may be empty or noisy — extract what is useful):');
  parts.push(scraped ? scraped.slice(0, 6000) : '(nothing scraped — design from the business name, category and city)');
  return parts.join('\n');
}

// ── Anthropic streaming call (raw HTTP SSE; returns assembled text) ──────────
async function callClaudeStream(env, system, userText, timeoutMs) {
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
    signal: AbortSignal.timeout(timeoutMs),
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

// Pull real photo URLs out of the scraped markdown so the mockup can reuse the
// client's actual imagery (hybrid image policy). Filters logos/icons/sprites and
// tiny/vector assets, absolutises relative URLs, dedupes, caps the list.
function extractImages(scraped, website) {
  if (!scraped) return [];
  let base = null;
  try { base = new URL(website && website.startsWith('http') ? website : 'https://' + (website || '')); } catch {}
  const urls = new Set();
  const md = /!\[[^\]]*\]\(([^)\s]+)/g; // markdown images
  const html = /<img[^>]+src=["']([^"']+)["']/gi; // any inline <img>
  for (const re of [md, html]) {
    let m;
    while ((m = re.exec(scraped)) && urls.size < 40) {
      let u = (m[1] || '').trim();
      if (!u || u.startsWith('data:')) continue;
      if (/^\/\//.test(u)) u = 'https:' + u;
      else if (base && !/^https?:\/\//i.test(u)) { try { u = new URL(u, base).href; } catch { continue; } }
      if (!/^https?:\/\//i.test(u)) continue;
      // skip logos, icons, sprites, tracking pixels, and vector/animated assets
      if (/(logo|icon|sprite|favicon|pixel|badge|avatar|placeholder|1x1|spacer)/i.test(u)) continue;
      if (/\.(svg|gif)(\?|$)/i.test(u)) continue;
      urls.add(u.split('#')[0]);
    }
  }
  return [...urls].slice(0, 10);
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

    const startedAt = Date.now();
    try {
      const scraped = await scrape(place.website);
      const images = extractImages(scraped, place.website);
      const ctx = businessBlock(place, branding, scraped, images);
      // Curated design intelligence (palettes/fonts/patterns/styles) matched to
      // the business type — extracted from the ui-ux-pro-max skill data.
      const brief = designBrief(place, branding);

      // DESIGN pass — primary; must finish. Give it the bulk of the budget.
      let html = extractHtml(await callClaudeStream(
        env, designSystem(),
        ctx + '\n\n' + brief + '\n\nNow build the complete website.',
        DESIGN_TIMEOUT_MS
      ));
      if (!looksComplete(html)) throw new Error('Design pass produced incomplete HTML.');

      // ART-DIRECTOR review/refine pass — only if enough of the total budget
      // remains to finish it without risking the platform hard-kill. Otherwise
      // ship the (already complete) design HTML rather than time out.
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt) - REVIEW_SAFETY_MS;
      if (remaining >= REVIEW_MIN_MS) {
        try {
          const reviewed = extractHtml(await callClaudeStream(
            env, reviewSystem(),
            businessBlock(place, branding, scraped, images) + '\n\n' + qaChecklist() +
              '\n\nHTML TO IMPROVE:\n' + html,
            remaining
          ));
          if (looksComplete(reviewed) && reviewed.length > html.length * 0.6) html = reviewed;
        } catch { /* keep design-pass HTML if review fails */ }
      }

      return withCors(json({ html, scrapedChars: scraped.length }));
    } catch (err) {
      return withCors(json({ error: String((err && err.message) || err) }, 502));
    }
  },
};
