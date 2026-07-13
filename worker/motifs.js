// Motif vocabulary for the CONCEPT pass — so two businesses in the same trade
// do NOT get the same 3D shape. Instead of one default silhouette per domain,
// the concept picks from a broad idea bank AND, crucially, from a universal set
// of "angles" on the business, choosing the motif that reflects THIS client's
// specific flagship / specialty (revealed in the scrape), not the generic one.

// A universal framework that applies to EVERY industry — the hologram subject
// can be drawn from any of these angles, whichever best fits this specific client.
const ANGLES = [
  'THE PRODUCT / OUTPUT — the thing they make or sell (a tooth, a car, a bottle, a dish, a house).',
  'THE TOOL / INSTRUMENT — what they work with (a dental probe, a wrench, an atomizer, a chef\'s knife, a trowel).',
  'THE RAW INGREDIENT / MATERIAL — what it is made from (a flower/essence for perfume, grain for bread, engine parts, enamel).',
  'THE RESULT / TRANSFORMATION — the outcome the customer buys (a radiant smile, a restored car, a scent trail, a growth curve).',
  'THE SIGNATURE SPACE — their environment (the clinic chair, the workshop, the atelier, the dining room).',
  'THE PROCESS IN MOTION — the craft as it happens (scanning, assembling, distilling, plating, building).',
];

// Rich per-domain idea banks. These are INSPIRATION, not a fixed list — the
// concept may combine, extend, or invent beyond them to fit the real client.
const MOTIFS = {
  health: [
    'Dentist: molar cross-section, single incisor, a full smile/mouth arch, an implant screw + abutment, a clear aligner, a dental mirror/probe, a bright "clean" sparkle, the treatment chair.',
    'Physio/fysio: spine & vertebrae, a knee or shoulder joint, muscle-fibre strands, a runner/body-in-motion silhouette, a kinetic chain of links, hands performing a manipulation.',
    'Medical/GP: an ECG line resolving into a heart, a stethoscope, protective cupped hands, a cell or molecule, a shield.',
    'Vet: a paw, a dog/cat silhouette, a heart with a paw inside.',
    'Pharmacy: a mortar & pestle, a capsule, a leaf crossed with a medical cross.',
    'Universal health cues: pulse line, cross, shield, molecule, cell, caring hands.',
  ],
  auto: [
    'A specific car body (sedan, van, classic), a wheel/tyre with tread, a brake disc, an engine block or piston, a gear/cog train, a spanner/wrench, a spark plug, a speedometer sweep, the drivetrain, a car raised on a lift.',
    'By specialty: tyre shop → tread pattern; body/paint shop → a sleek reflective repainted panel; diagnostics → an engine paired with a waveform readout; classic restoration → a vintage silhouette.',
  ],
  beauty: [
    'Perfumer: a flacon, an atomizer spray-burst, a botanical (rose, jasmine, iris), an essence droplet, a ribbon of scent, ingredient molecules.',
    'Hair salon: flowing hair strands, scissors, a comb, a face profile.',
    'Spa/wellness: a water ripple, a lotus, rising steam/vapour, stacked stones.',
    'Nails/lash/brow: a polished gem-like nail, a single brush stroke, an arched brow line.',
    'Tooth crystal / grillz: a faceted gem, a diamond sparkle.',
  ],
  home: [
    'Plumber: a pipe network, a water droplet, a valve/tap, a pipe wrench.',
    'Electrician: a lightning bolt, a glowing circuit/wiring path, a socket/plug, a lightbulb filament.',
    'Builder/renovation: a house frame or blueprint, a trowel, scaffolding, a wall assembling, a handover key.',
    'Roofer: a roof gable line; painter: a roller/brush stroke of colour; landscaper: a leaf or tree.',
  ],
  food: [
    'Restaurant: the signature plate/dish, a chef\'s knife, a grill flame, a wine glass, an arrangement of cutlery, hero ingredients (tomato, herbs).',
    'Bakery: a loaf or croissant, wheat/grain stalks, a rolling pin, steam off fresh bread.',
    'Cafe: a coffee cup, a bean, a latte swirl, rising steam.',
    'Brewery/winery: a glass filling, hops or grapes, a barrel, bubbles rising.',
  ],
  general: [
    'Accountant/finance: rising bars, a coin/€ symbol, a ledger grid, a growth arrow, a balanced scale.',
    'Legal: the scales of justice, a gavel, an authority column/pillar, a shield, a document seal.',
    'Consultancy: an interlocking node network, a compass, an idea lightbulb, a rising path, puzzle pieces locking together.',
    'B2B/agency/SaaS: an abstract data-flow network, a crafted geometric emblem, converging lines.',
  ],
};

export function motifBlock(domain) {
  const bank = MOTIFS[domain] || MOTIFS.general;
  const lines = [];
  lines.push('MOTIF SELECTION (how to make the 3D subject SPECIFIC to this client, not generic):');
  lines.push('');
  lines.push('Choose the hologram subject from ANY of these angles on the business — pick the one that');
  lines.push('best captures what makes THIS client distinctive (their flagship service, their specialty,');
  lines.push('their niche, their differentiator as revealed in the scrape):');
  for (const a of ANGLES) lines.push('  • ' + a);
  lines.push('');
  lines.push('Idea bank for this trade (inspiration — combine or go beyond it, do not just take the first):');
  for (const m of bank) lines.push('  - ' + m);
  lines.push('');
  lines.push('HARD RULE — DIFFERENTIATE: do NOT default to the single most obvious motif (e.g. a plain');
  lines.push('tooth for every dentist). Two businesses in the same trade must get DIFFERENT subjects,');
  lines.push('driven by their specialty: an implant clinic → an implant/screw forming; an orthodontist →');
  lines.push('aligners/a brace; a whitening studio → a radiant smile; a kids\' practice → a friendly tooth');
  lines.push('character. If your chosen motif would fit any competitor equally, you have not looked hard');
  lines.push('enough at what makes THIS one specific — pick again from the angles above.');
  return lines.join('\n');
}
