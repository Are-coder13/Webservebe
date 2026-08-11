// Worked design exemplars — few-shot taste anchors for the DESIGN pass.
//
// The recipes teach the model HOW to build a cinematic scene; these teach it
// WHAT a strong designer decides. Each exemplar is a compact worked example of
// the STEP 1–3 reasoning (offering -> feeling -> 3D story -> chapters), written
// the way we want the model's own CONCEPT to read. Models pick up judgment from
// concrete examples far faster than from adjectives, so we inject the 1–2
// exemplars that match the business domain into the design prompt.
//
// These are DELIBERATELY not templates to copy — they are calibration. The
// prompt tells the model to invent its own concept at this level of specificity,
// not to reuse these shapes.

const EXEMPLARS = {
  health: [
    {
      biz: 'Dental clinic (Antwerp)',
      offering: 'gentle, precise implant & cosmetic dentistry',
      feeling: 'quiet reassurance — dissolve the fear of the chair into calm, clinical confidence',
      story: 'a cloud of cool particles drifts, then scroll-morphs into a glowing cross-section of a molar (RECIPE G) while the copy talks about painless precision; a slow orbit reveals it is flawless',
      chapters: 'hero (name + "tandheelkunde zonder angst", wide) -> care philosophy (push-in) -> the tooth hologram forms as we name real treatments (orbit + scan HUD) -> patient trust stats & reviews (close approach) -> boek een afspraak CTA (settle)',
      editorial: 'giant outlined word PRECISIE cropped behind the hologram',
      why: 'the 3D IS the pitch — precision you can literally see — and the scan HUD is legitimate here because dentistry is precision-coded. Cool blues keep it clinical, not cold.',
    },
  ],
  auto: [
    {
      biz: 'Auto repair / garage',
      offering: 'expert diagnostics and honest mechanical repair',
      feeling: 'pride and trust — your car in the hands of people who actually understand it',
      story: 'a lissajous ribbon of light (RECIPE C) sweeps like a rev, and particles assemble into a glowing gear/piston silhouette (RECIPE G) as the diagnostics chapter arrives',
      chapters: 'hero (name + promise, wide low-angle) -> what we fix, real services (push-in) -> the engine-part hologram forms over a diagnostics readout (orbit + HUD) -> years of experience / reviews (close approach) -> maak een afspraak CTA (settle)',
      editorial: 'giant word VAKMANSCHAP clipped behind the drivetrain',
      why: 'motion evokes speed/mechanics without a single car photo; dark near-black with a hot accent reads premium-garage, and diagnostics justify the HUD.',
    },
  ],
  beauty: [
    {
      biz: 'Perfumer / luxury beauty house',
      offering: 'bespoke fragrance, an artisanal signature scent',
      feeling: 'sensory desire and refinement — scent made visible',
      story: 'a torus-knot ribbon of shimmering particles (RECIPE C) breathes like a trail of scent, gathering into a glowing flacon silhouette (RECIPE G); no HUD — warmth, not tech',
      chapters: 'hero (maison name + poetic line, wide) -> the craft / notes (slow push-in) -> the flacon forms as the signature scent is named (gentle orbit) -> heritage & press quotes (close approach) -> reserveer / ontdek CTA (settle)',
      editorial: 'giant serif word SILLAGE or the house name, half-cropped, gold on near-black',
      why: 'restraint is the luxury signal — no HUD, slower eases (400–600ms), a single gold accent on black, editorial serif. The scent-trail metaphor is felt, not literal.',
    },
  ],
  food: [
    {
      biz: 'Restaurant / brasserie',
      offering: 'a seasonal kitchen with a signature dish',
      feeling: 'warmth and appetite — the glow of a full table at night',
      story: 'a warm flat spiral-galaxy of embers (RECIPE C) turns slowly; particles gather into the silhouette of the signature plate/dish (RECIPE G) as the menu chapter lands — warm, no HUD',
      chapters: 'hero (name + kitchen promise, wide) -> the kitchen philosophy (push-in) -> signature dish forms as it is named (orbit) -> ambiance & guest words (close approach) -> reserveer een tafel CTA (settle)',
      editorial: 'giant warm word like PROEF or VUUR behind the plate',
      why: 'warm reds/ambers over near-black feel like candlelight; the plate-forming moment is mouth-watering. A scan HUD would kill the warmth — deliberately omitted.',
    },
  ],
  home: [
    {
      biz: 'Home services (plumber / electrician / builder)',
      offering: 'reliable, on-time installation and repair for the home',
      feeling: 'relief and dependability — the problem handled by a real pro',
      story: 'a calm helix light-strand (RECIPE C) like a clean pipe/cable run; particles assemble into a glowing house/tool silhouette (RECIPE G) at the "what we do" chapter',
      chapters: 'hero (name + "vandaag nog geholpen", wide) -> services grid (push-in) -> the house hologram forms with real services labelled (orbit + light HUD for the technical trades) -> guarantees & reviews (close approach) -> bel of vraag een offerte CTA (settle)',
      editorial: 'giant word VAKWERK or BETROUWBAAR clipped behind the structure',
      why: 'professional blue with an urgent accent signals trustworthy-but-responsive; the forming house makes an abstract service concrete.',
    },
  ],
  general: [
    {
      biz: 'Professional services (accountant / law / consultancy)',
      offering: 'expert advice that removes financial or legal risk',
      feeling: 'authority and calm control — complexity made clear',
      story: 'a precise helix or octahedron lattice (RECIPE D) rotates like ordered structure emerging from noise; particles resolve into a clean geometric emblem (RECIPE G) at the expertise chapter',
      chapters: 'hero (firm name + authoritative promise, wide) -> areas of expertise, real services (push-in) -> the emblem forms as the flagship service is named (orbit + subtle HUD for the analytical framing) -> track record / stats (close approach) -> plan een gesprek CTA (settle)',
      editorial: 'giant word HELDERHEID or ZEKERHEID, outlined, behind the lattice',
      why: 'navy authority + restraint reads senior, not flashy; "order from noise" visually argues that they make the complicated simple.',
    },
  ],
};

// Return a prompt-ready block with the exemplar(s) for this domain.
export function exemplarBlock(domain) {
  const list = EXEMPLARS[domain] || EXEMPLARS.general;
  const lines = [
    'WORKED CONCEPT EXEMPLAR (calibration — how a strong designer reasons about a',
    'business like this before writing any code). Match this LEVEL of specificity and',
    'conviction, but invent your OWN concept for the actual business — do NOT copy these',
    'shapes or words:',
    '',
  ];
  for (const e of list) {
    lines.push(`• ${e.biz}`);
    lines.push(`  offering: ${e.offering}`);
    lines.push(`  feeling: ${e.feeling}`);
    lines.push(`  3d-story: ${e.story}`);
    lines.push(`  chapters: ${e.chapters}`);
    lines.push(`  editorial: ${e.editorial}`);
    lines.push(`  why it works: ${e.why}`);
    lines.push('');
  }
  return lines.join('\n');
}
