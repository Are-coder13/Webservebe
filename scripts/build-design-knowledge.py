#!/usr/bin/env python3
"""Extract the local-business-relevant slice of the UI/UX Pro Max data
(palettes, font pairings, landing patterns, styles, UX checklist) into a
self-contained JS module the Cloudflare worker can use without Python."""
import csv, json, os

import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = str(ROOT / ".claude/skills/ui-ux-pro-max/data")
OUT = str(ROOT / "worker/design-knowledge.js")

# ── domain mappings (business type -> which curated rows apply) ───────────────
PALETTE_DOMAINS = {
    "Dental Practice": ["health"], "Medical Clinic": ["health"],
    "Healthcare App": ["health"], "Pharmacy/Drug Store": ["health"],
    "Patient Portal / Health Records": ["health"], "Telemedicine Platform": ["health"],
    "Veterinary Clinic": ["health"], "Mental Health App": ["health", "beauty"],
    "Beauty/Spa/Wellness Service": ["beauty", "health"], "Luxury/Premium Brand": ["beauty"],
    "Photography Studio": ["beauty"], "Automotive/Car Dealership": ["auto"],
    "Home Services (Plumber/Electrician)": ["home", "auto"], "Logistics/Delivery": ["auto", "home"],
    "Construction/Architecture": ["home", "auto"], "Real Estate/Property": ["home", "general"],
    "Restaurant/Food Service": ["food"], "Bakery/Cafe": ["food"], "Brewery/Winery": ["food"],
    "Hyperlocal Services": ["general", "home"], "B2B Service": ["general"],
    "SaaS (General)": ["general"], "Booking & Appointment App": ["general", "health"],
    "Legal Services": ["general"], "Local Events & Discovery": ["general"],
}
FONT_DOMAINS = {
    "Medical Clean": ["health"], "Corporate Trust": ["health", "home", "general"],
    "Wellness Calm": ["health", "beauty"], "Accessibility First": ["health", "general"],
    "Soft Rounded": ["health", "beauty"], "Modern Professional": ["general", "health", "home", "auto"],
    "Kinetic Motion": ["auto"], "Bold Statement": ["auto", "home", "general"],
    "Startup Bold": ["auto", "general"], "Geometric Modern": ["general", "auto", "home"],
    "Premium Sans": ["general", "auto", "beauty"], "Classic Elegant": ["beauty", "food"],
    "Luxury Serif": ["beauty"], "Fashion Forward": ["beauty"], "Luxury Minimalist": ["beauty"],
    "Restaurant Menu": ["food"], "Retro Vintage": ["food"], "Friendly SaaS": ["general"],
    "Real Estate Luxury": ["home"],
}
STYLE_DOMAINS = {
    "Minimalism & Swiss Style": ["health", "auto", "beauty", "home", "food", "general"],
    "Soft UI Evolution": ["health", "general", "beauty"],
    "Glassmorphism": ["general", "auto", "beauty"],
    "Trust & Authority": ["health", "home", "general", "auto"],
    "Hero-Centric Design": ["health", "auto", "beauty", "home", "food", "general"],
    "Conversion-Optimized": ["health", "auto", "beauty", "home", "food", "general"],
    "Social Proof-Focused": ["health", "auto", "beauty", "home", "food", "general"],
    "Bento Grids": ["general", "auto"],
    "Editorial Grid / Magazine": ["beauty", "general", "food"],
    "Organic Biophilic": ["health", "beauty", "food"],
    "Motion-Driven": ["auto", "general"],
    "Aurora UI": ["general", "beauty"],
    "Gradient Mesh / Aurora Evolved": ["general", "beauty", "auto"],
}
PATTERN_DOMAINS = {
    "Hero + Features + CTA": ["health", "auto", "beauty", "home", "food", "general"],
    "Hero + Testimonials + CTA": ["health", "auto", "beauty", "home", "food", "general"],
    "Trust & Authority + Conversion": ["health", "auto", "beauty", "home", "food", "general"],
    "Hero-Centric Design": ["health", "auto", "beauty", "home", "food", "general"],
    "Feature-Rich Showcase": ["general", "auto", "home"],
    "Before-After Transformation": ["health", "beauty", "auto", "home"],
    "Bento Grid Showcase": ["general", "auto"],
    "Scroll-Triggered Storytelling": ["general", "auto", "beauty"],
}

# ui-reasoning.csv shares the local-business category names with colors.csv, so
# reuse the palette domain map to pick the decision-rules rows that apply.
REASONING_DOMAINS = PALETTE_DOMAINS

def rows(name):
    with open(os.path.join(DATA, name), newline="") as f:
        return list(csv.DictReader(f))

import re
def humanize_rules(raw):
    """Decision_Rules cells are JSON-ish maps like
    {"if_luxury": "switch-to-liquid-glass", "must_have": "case-studies"}.
    Render them as short readable 'condition -> action' phrases. Uses a regex
    (not json.loads) because cells can repeat a key, e.g. two "must_have"s."""
    raw = (raw or "").strip()
    if not raw:
        return []
    pairs = re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', raw)
    if not pairs:
        return [raw]
    return [f'{k.replace("_", " ")}: {v.replace("-", " ")}' for k, v in pairs]

# ── palettes ─────────────────────────────────────────────────────────────────
palettes = []
for r in rows("colors.csv"):
    t = r["Product Type"]
    if t not in PALETTE_DOMAINS:
        continue
    palettes.append({
        "domains": PALETTE_DOMAINS[t], "type": t,
        "primary": r["Primary"], "onPrimary": r["On Primary"],
        "secondary": r["Secondary"], "accent": r["Accent"], "onAccent": r["On Accent"],
        "bg": r["Background"], "fg": r["Foreground"], "muted": r["Muted"],
        "border": r["Border"], "ring": r["Ring"], "notes": r["Notes"],
    })

# ── fonts ────────────────────────────────────────────────────────────────────
fonts = []
for r in rows("typography.csv"):
    n = r["Font Pairing Name"]
    if n not in FONT_DOMAINS:
        continue
    fonts.append({
        "domains": FONT_DOMAINS[n], "name": n,
        "heading": r["Heading Font"], "body": r["Body Font"],
        "mood": r["Mood/Style Keywords"], "url": r["Google Fonts URL"],
    })

# ── styles ───────────────────────────────────────────────────────────────────
styles = []
for r in rows("styles.csv"):
    n = r["Style Category"]
    if n not in STYLE_DOMAINS:
        continue
    styles.append({
        "domains": STYLE_DOMAINS[n], "name": n,
        "keywords": r["Keywords"], "effects": r["Effects & Animation"],
        "bestFor": r["Best For"],
    })

# ── landing patterns ─────────────────────────────────────────────────────────
patterns = []
for r in rows("landing.csv"):
    n = r["Pattern Name"]
    if n not in PATTERN_DOMAINS:
        continue
    patterns.append({
        "domains": PATTERN_DOMAINS[n], "name": n,
        "sections": r["Section Order"], "cta": r["Primary CTA Placement"],
        "colorStrategy": r["Color Strategy"], "effects": r["Recommended Effects"],
    })

# ── UX checklist (High-severity "Do" items) ──────────────────────────────────
seen, checklist = set(), []
for r in rows("ux-guidelines.csv"):
    if r["Severity"] != "High":
        continue
    item = f'{r["Category"]}: {r["Do"]}'
    if r["Do"] and item not in seen:
        seen.add(item)
        checklist.append(item)

# ── reasoning (decision rules + anti-patterns per business type) ──────────────
reasoning = []
for r in rows("ui-reasoning.csv"):
    cat = r["UI_Category"]
    if cat not in REASONING_DOMAINS:
        continue
    reasoning.append({
        "domains": REASONING_DOMAINS[cat], "type": cat,
        "colorMood": r["Color_Mood"], "typographyMood": r["Typography_Mood"],
        "decisionRules": humanize_rules(r["Decision_Rules"]),
        "antiPatterns": [a.strip() for a in (r["Anti_Patterns"] or "").split("+") if a.strip()],
    })

def dump(name, obj):
    return f"export const {name} = " + json.dumps(obj, ensure_ascii=False, indent=2) + ";\n"

header = """// AUTO-GENERATED from .claude/skills/ui-ux-pro-max data (curated for local
// service-business mockups). Regenerate with scripts/build-design-knowledge.py.
// Source: ui-ux-pro-max-skill (MIT). Do not hand-edit the data arrays.
"""

body = """
// Map a business (Dutch/English name, category, scraped text) to a broad domain.
const DOMAIN_SIGNALS = {
  health: ['tandarts', 'tandheelk', 'dental', 'dentist', 'dentias', 'orthodont', 'mondzorg',
           'kliniek', 'clinic', 'smile', 'tandarts', 'huisarts', 'fysio', 'apotheek', 'zorg',
           'medical', 'health', 'gezondheid', 'praktijk'],
  auto: ['garage', 'auto', 'autoservice', 'autos', 'wagen', 'herstel', 'onderhoud', 'banden',
         'carrosserie', 'takel', 'depannage', 'motronik', 'pechverhelping', 'repair', 'car',
         'mechanic', 'monteur', 'vulcaniseer'],
  beauty: ['grillz', 'kristal', 'tandkristal', 'bluetoothgem', 'beauty', 'salon', 'spa',
           'schoonheid', 'nagel', 'kapper', 'wellness', 'esthetiek', 'brow', 'lash'],
  home: ['loodgieter', 'elektricien', 'plumber', 'electrician', 'dakwerk', 'schilder',
         'aannemer', 'renovatie', 'bouw', 'tuin', 'ramen', 'installatie'],
  food: ['restaurant', 'brasserie', 'cafe', 'koffie', 'bakker', 'bakkerij', 'eten', 'food',
         'bistro', 'traiteur', 'frituur'],
};

export function classifyDomain(text) {
  const t = (text || '').toLowerCase();
  let best = 'general', bestScore = 0;
  for (const [domain, words] of Object.entries(DOMAIN_SIGNALS)) {
    const score = words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = domain; }
  }
  return best;
}

const inDomain = (arr, d) => arr.filter(x => x.domains.includes(d));

// Pick a curated shortlist for a business. Returns options for Claude to CHOOSE
// from (deliberately not a single auto-pick — the model judges fit better).
export function pickShortlist(place, branding) {
  const text = [place && place.name, place && place.category,
                branding && (branding.notes || '')].filter(Boolean).join(' ');
  const domain = classifyDomain(text);
  const pick = (arr, n) => {
    const d = inDomain(arr, domain);
    const pool = d.length ? d : inDomain(arr, 'general');
    return pool.slice(0, n);
  };
  return {
    domain,
    palettes: pick(PALETTES, 4),
    fonts: pick(FONTS, 4),
    patterns: pick(PATTERNS, 3),
    styles: pick(STYLES, 3),
    reasoning: pick(REASONING, 2),
  };
}

// Prompt-ready design brief for the DESIGN pass: curated options + guidance.
export function designBrief(place, branding) {
  const s = pickShortlist(place, branding);
  const lines = [];
  lines.push('DESIGN INTELLIGENCE (curated references for a ' + s.domain +
             ' business — pick what genuinely fits; adapt freely, do not feel bound):');
  lines.push('');
  lines.push('Candidate colour palettes (hex; use as CSS custom properties):');
  for (const p of s.palettes) {
    lines.push(`- ${p.type}: primary ${p.primary} / on-primary ${p.onPrimary}, ` +
      `secondary ${p.secondary}, accent/CTA ${p.accent} / on-accent ${p.onAccent}, ` +
      `bg ${p.bg}, fg ${p.fg}, muted ${p.muted}, border ${p.border}. (${p.notes})`);
  }
  lines.push('');
  lines.push('Candidate font pairings (load via Google Fonts):');
  for (const f of s.fonts) {
    lines.push(`- ${f.name}: headings "${f.heading}", body "${f.body}" — ${f.mood}. ${f.url}`);
  }
  lines.push('');
  lines.push('Candidate layout patterns:');
  for (const p of s.patterns) {
    lines.push(`- ${p.name}: ${p.sections} | CTA: ${p.cta}`);
  }
  lines.push('');
  lines.push('Candidate visual styles:');
  for (const st of s.styles) {
    lines.push(`- ${st.name}: ${st.keywords}. Effects: ${st.effects}`);
  }
  if (s.reasoning && s.reasoning.length) {
    lines.push('');
    lines.push('DESIGN DECISION RULES & ANTI-PATTERNS (expert judgment for this business type). ' +
               'Use the mood cues as brand direction and honour the colour/credibility anti-patterns ' +
               '(e.g. no neon, no AI purple/pink gradients, never hide credentials, no playful tone on a ' +
               'serious trade). NOTE: this site is a deliberately dark, cinematic WebGL experience — where ' +
               'a rule conflicts with that medium (e.g. "avoid dark mode", "avoid animation"), the cinematic ' +
               'direction wins; apply the rule\\'s spirit to palette, type and restraint instead:');
    for (const r of s.reasoning) {
      lines.push(`- ${r.type}: colour mood → ${r.colorMood}; type mood → ${r.typographyMood}.`);
      if (r.decisionRules && r.decisionRules.length) {
        lines.push(`  decide: ${r.decisionRules.join('; ')}.`);
      }
      if (r.antiPatterns && r.antiPatterns.length) {
        lines.push(`  AVOID: ${r.antiPatterns.join('; ')}.`);
      }
    }
  }
  return lines.join('\\n');
}

// Prompt-ready QA checklist for the REVIEW pass.
export function qaChecklist() {
  return 'PRE-DELIVERY UX CHECKLIST (verify each; fix violations):\\n' +
    CHECKLIST.map(c => '- ' + c).join('\\n');
}
"""

with open(OUT, "w") as f:
    f.write(header)
    f.write("\n" + dump("PALETTES", palettes))
    f.write("\n" + dump("FONTS", fonts))
    f.write("\n" + dump("STYLES", styles))
    f.write("\n" + dump("PATTERNS", patterns))
    f.write("\n" + dump("REASONING", reasoning))
    f.write("\n" + dump("CHECKLIST", checklist))
    f.write(body)

print(f"Wrote {OUT}")
print(f"  palettes={len(palettes)} fonts={len(fonts)} styles={len(styles)} "
      f"patterns={len(patterns)} reasoning={len(reasoning)} checklist={len(checklist)}")
