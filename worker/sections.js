// Section blueprint library for CLEAN / PROFESSIONAL mode (the "Webild-quality"
// path). The best AI builders don't free-generate layout — they compose pages
// from professionally-designed, named section patterns and fill them with the
// client's brand + content. This module is that library: a menu of proven
// sections with concrete layout/spacing/type specs, plus the modern (2026)
// design principles that make output read as high-end rather than templated.
//
// Aesthetic target: clean, confident, conversion-focused business sites —
// generous whitespace, bold oversized display type, a restrained palette
// anchored to the real brand, tasteful micro-interactions, mobile-first. Light
// OR dark depending on the brand (most professional service sites are light).
// Still fully self-contained and asset-free: CSS gradients/shapes + inline SVG,
// no external photos.

const PRINCIPLES = [
  'BOLD TYPOGRAPHY: oversized display headlines (clamp ~40–88px) in a distinctive heading face, paired with a clean readable body face. Strong, deliberate type-scale contrast. This does the heavy lifting.',
  'GENEROUS WHITESPACE: roomy section padding (clamp ~72–140px vertical), a clear max-width container (~1100–1240px), calm rhythm. Crowding reads as cheap.',
  'RESTRAINED PALETTE: anchor to the real brand colours + neutrals. ONE accent, used sparingly for CTAs and key highlights. Consider a monochrome or warm-neutral scheme. Never rainbow.',
  'LIGHT OR DARK by brand: choose a light, airy scheme (off-white bg, dark ink text) for most professional/service brands, OR a refined dark scheme for luxury/tech. Commit fully; keep WCAG AA contrast.',
  'TASTEFUL MOTION: fade/slide-up reveals on scroll (IntersectionObserver, 150–300ms), hover lifts on cards/buttons, subtle CTA emphasis. Micro-interactions, never gratuitous. Respect prefers-reduced-motion.',
  'TRUST & SOCIAL PROOF: surface real stats, ratings, review counts, credentials, guarantees — "Join 5,000+…", star ratings, years in business. Credibility fast.',
  'MOBILE-FIRST: >75% of traffic is mobile. Every section must be flawless at 375px; stack columns, keep 16px+ body text, 44px+ touch targets, no horizontal scroll.',
  'BESPOKE SVG: custom inline <svg> icons per service (via <path>, with the brand accent), tasteful CSS gradient/mesh backdrops and soft shadows. No emoji, no unicode icons, no external images.',
  'CARD ALIGNMENT (non-negotiable): any multi-card row uses CSS grid with EQUAL columns (grid-template-columns: repeat(N, 1fr); align-items: stretch) so all cards are the SAME size and align on both axes. Make each card display:flex; flex-direction:column so titles, bodies and footers/CTAs line up across cards regardless of text length (push CTAs down with margin-top:auto). No ragged heights, no misaligned rows.',
  'REAL CONTENT ONLY: real service names, real tone, real city from the scrape. No lorem, no generic filler ("Quality You Can Trust").',
];

// The blueprint menu. Each entry: a proven section with a concrete spec. The
// designer composes 6–9 of these into a coherent page (see composition rules).
const BLUEPRINTS = [
  ['Hero — split', 'Headline + subhead + primary CTA on the left; a visual card/panel on the right (a bespoke SVG illustration, a stat card, or a gradient/mesh panel with the logo). Best default for services.'],
  ['Hero — centered statement', 'One huge centered display headline over a subtle gradient/mesh backdrop, tight subhead, one CTA. Confident and minimal — good for premium/luxury brands.'],
  ['Hero — offset editorial', 'Asymmetric: oversized headline spanning wide, supporting copy in a narrow column, a floating accent shape. Magazine feel.'],
  ['Trust bar', 'A slim strip directly under the hero: 3–5 real stats/badges/ratings, or "trusted by / years of experience". Small, quiet, credibility-building.'],
  ['Product / collection showcase', 'THE centrepiece for a product brand. A grid grouped by collection where EACH product is a bespoke crafted ARTEFACT — a detailed inline-SVG rendering of the actual item (bottle, garment, jewel, dish…), spotlit in an equal-size card with its real name + one line, subtle float/hover. The flagship product gets a larger hero treatment. Never a generic icon grid.'],
  ['Services — bento grid', 'An asymmetric bento of cards (mixed sizes) for the core offerings, each with a bespoke SVG icon, title, one line. Apple-style, modern.'],
  ['Services — 3-up cards', 'A clean 3-column card row (stacks on mobile) with SVG icon, service name, short benefit. Hover lift.'],
  ['Feature rows — alternating', 'Alternating image-left / image-right rows (the "image" is a bespoke SVG/gradient composition), each pairing one real service with a benefit-led paragraph. Great for depth.'],
  ['Stats band', 'A full-width band with 3–4 big animated numbers (count-up on scroll) — years, patients/clients, rating, projects. High impact, low text.'],
  ['Process / steps', 'A numbered horizontal or vertical timeline (3–5 steps) with a connector line, explaining how it works. Reduces friction.'],
  ['About / why-us', 'A two-column editorial block: a strong sub-headline + narrative on one side, a supporting list of differentiators or a portrait-shaped SVG on the other.'],
  ['Testimonials', 'Review cards with real quote, name, and role/context (ONLY if reviews exist in the scrape — otherwise omit; never fabricate). Star ratings, avatars via initials.'],
  ['FAQ accordion', 'A tidy accordion of 4–6 real questions. Builds trust, aids SEO. Keyboard-accessible.'],
  ['CTA band', 'A strong closing section on the accent/brand colour: a clear promise + one prominent CTA (book, call, quote). The conversion moment.'],
  ['Footer', 'Real NAP (name, address, phone), opening hours, a small nav, logo. Clean, multi-column, muted.'],
];

// Loose per-domain nudges — which hero/vibe tends to fit. Not binding.
const DOMAIN_HINT = {
  health: 'Calm, clean, trustworthy — light scheme, soft rounded cards, reassuring. Split or centered hero. Prominent stats (patients, rating) + FAQ.',
  auto: 'Confident, precise — can go darker/industrial. Before/after or process section works well. Strong stats + booking CTA.',
  beauty: 'Elegant, editorial — luxury serif display, lots of whitespace, refined accent. Centered or editorial hero, gallery-style bento.',
  home: 'Dependable, direct — clear services grid, guarantees/trust bar, prominent phone CTA. Light, solid, no-nonsense.',
  food: 'Warm, appetising — rich accent, editorial hero, menu-style bento, ambiance in copy. Reservation CTA.',
  general: 'Professional, authoritative — restrained navy/neutral, strong type, stats + testimonials + clear CTA. Corporate-clean.',
};

export function cleanBrief(domain) {
  const lines = [];
  lines.push('CLEAN / PROFESSIONAL BUILD — compose a polished, modern, conversion-focused business');
  lines.push('landing page by ASSEMBLING the section blueprints below (this is how top AI builders reach');
  lines.push('agency quality — proven structures filled with real brand + content, not invented layout).');
  lines.push('');
  lines.push('MODERN DESIGN PRINCIPLES (apply all):');
  for (const p of PRINCIPLES) lines.push('- ' + p);
  lines.push('');
  lines.push('SECTION BLUEPRINTS (choose 6–9 that fit this business; pick ONE hero; vary the rest):');
  for (const [name, spec] of BLUEPRINTS) lines.push(`- ${name}: ${spec}`);
  lines.push('');
  lines.push('COMPOSITION RULES:');
  lines.push('- Order: hero → trust bar → services → (feature rows / about / stats / process) → testimonials/FAQ → CTA band → footer.');
  lines.push('- Vary layout between adjacent sections (do not stack identical centred blocks). Alternate alignment and column counts.');
  lines.push('- Only include a section if there is REAL content for it (skip testimonials with no reviews, pricing if none).');
  lines.push('- One consistent design system: define colours, type scale, spacing, radius, shadows as CSS custom properties in :root.');
  lines.push('');
  if (DOMAIN_HINT[domain]) lines.push('DOMAIN NUDGE (' + domain + '): ' + DOMAIN_HINT[domain]);
  return lines.join('\n');
}
