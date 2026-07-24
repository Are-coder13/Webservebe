// Deterministic palette builder — takes colour OUT of the model's hands.
//
// Prompt rules alone don't guarantee the brand colour is used (the model
// drifts, hardcodes its own hues, or falls back to generic blue). Instead we
// compute a coherent set of design tokens here — from the real brand colour
// when we have one, or a DOMAIN-CORRECT default when we don't (beauty is rose,
// never blue) — hand them to the model as the only colours it may use, and lock
// them into the output so they win regardless of what the model wrote.

// ── colour maths (dependency-free) ─────────────────────────────────────────
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = m[1];
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function luminance([r, g, b]) {
  const a = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
// pick #fff or a near-black ink for best contrast on a background hex
function onColor(hex) {
  const rgb = hexToRgb(hex) || [0, 0, 0];
  return luminance(rgb) > 0.42 ? '#141414' : '#ffffff';
}
// most saturated (and not too dark/light) of the candidate brand hexes
function pickBrand(colors) {
  let best = null, bestScore = -1;
  for (const c of colors || []) {
    const rgb = hexToRgb(c); if (!rgb) continue;
    const [, s, l] = rgbToHsl(...rgb);
    const score = s - Math.abs(l - 0.5) * 0.6; // favour saturated, mid-lightness
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// ── domain-correct defaults (used only when no brand colour) ────────────────
// hue (deg) + whether the trade reads warm/luxury. NEVER blue for beauty/food.
const DOMAIN_HUE = {
  beauty: 330,   // rose / mauve
  food: 18,      // warm red / terracotta
  health: 185,   // calm teal/cyan
  home: 210,     // dependable blue
  auto: 4,       // bold red (on dark)
  general: 222,  // professional navy
};

/**
 * buildPalette(brandColors, domain, style) → { vars, css, source }
 * style: 'cinematic' (dark, brand = glow) or 'clean' (light, brand = accent).
 */
export function buildPalette(brandColors, domain, style) {
  const brand = pickBrand(brandColors);
  const source = brand ? 'brand' : 'domain-default';
  let h, s;
  if (brand) {
    const [bh, bs] = rgbToHsl(...hexToRgb(brand));
    h = bh; s = Math.max(0.45, Math.min(0.9, bs || 0.6));
  } else {
    h = DOMAIN_HUE[domain] != null ? DOMAIN_HUE[domain] : DOMAIN_HUE.general;
    s = domain === 'general' || domain === 'home' ? 0.6 : 0.7;
  }

  const brandHex = brand || hslToHex(h, s, 0.5);
  const brand2 = hslToHex(h, Math.min(1, s + 0.05), 0.38);            // deeper
  const accent = hslToHex((h + 24) % 360, Math.min(1, s + 0.05), 0.55); // sibling accent for CTAs

  let vars;
  if (style === 'cinematic') {
    // near-black canvas, brand as the glow accent
    vars = {
      '--brand': hslToHex(h, s, 0.6),
      '--brand-2': hslToHex((h + 24) % 360, s, 0.62),
      '--accent': hslToHex(h, s, 0.6),
      '--bg': hslToHex(h, 0.30, 0.05),
      '--ink': '#f4f5f7',
      '--muted': 'rgba(244,245,247,0.66)',
      '--border': 'rgba(244,245,247,0.14)',
      '--on-brand': '#0a0a0f',
      '--on-accent': '#0a0a0f',
    };
  } else {
    // clean/professional: light, airy, brand as accent — unless brand is dark/luxury
    const [, , bl] = brand ? rgbToHsl(...hexToRgb(brand)) : [0, 0, 0.5];
    const luxuryDark = brand && bl < 0.22;
    if (luxuryDark) {
      vars = {
        '--brand': brandHex, '--brand-2': brand2, '--accent': accent,
        '--bg': '#0f0f12', '--ink': '#f4f2ee', '--muted': 'rgba(244,242,238,0.66)',
        '--border': 'rgba(244,242,238,0.14)', '--on-brand': onColor(brandHex), '--on-accent': onColor(accent),
      };
    } else {
      vars = {
        '--brand': brandHex,
        '--brand-2': brand2,
        '--accent': accent,
        '--bg': '#fbfaf9',
        '--ink': '#17151a',
        '--muted': '#6b6570',
        '--border': 'rgba(23,21,26,0.10)',
        '--surface': '#ffffff',
        '--on-brand': onColor(brandHex),
        '--on-accent': onColor(accent),
      };
    }
  }

  const css = ':root{' + Object.entries(vars).map(([k, v]) => k + ':' + v).join(';') + '}';
  return { vars, css, source, brandHex };
}

// Prompt-ready description of the palette tokens + rules.
export function paletteBrief(pal) {
  const roles = [
    '--brand: the primary brand colour (headlines accents, key highlights, the 3D glow in cinematic mode)',
    '--brand-2: a deeper brand shade (gradients, hovers)',
    '--accent: the CTA / action colour',
    '--bg: page background', '--ink: main text', '--muted: secondary text',
    '--border: hairlines/dividers', '--on-brand / --on-accent: text ON brand/accent fills',
  ];
  return [
    'PALETTE — the colour system is DECIDED (' + pal.source + '). Use these EXACT CSS custom',
    'properties for EVERY colour. Do NOT hardcode any hex/rgb anywhere in the body CSS — reference',
    'the tokens only. Put this block in :root verbatim (you may add tints via color-mix if needed):',
    pal.css,
    'Token roles: ' + roles.join('; ') + '.',
  ].join('\n');
}
