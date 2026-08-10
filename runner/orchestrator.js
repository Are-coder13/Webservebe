// The orchestrator — the "Manus for websites" loop, run async per job.
//
// It reuses the EXACT prompt builders + helpers from the Worker (imported, not
// copied) so worker and runner stay one brain. Phase 1 mirrors the Worker's
// pipeline (research → strategy → build → QA loop → deliver) but async, with a
// live to-do plan and native Playwright rendering. Phases 2–4 add the planner
// sub-agent, competitor web_search research, and parallel sub-agents (marked
// with TODO below).

import {
  designSystem, cleanSystem, conceptSystem, conceptBrief, reviewSystem,
  businessBlock, extractJson, extractHtml, looksComplete, renderReport, enforcePalette, scrape,
} from '../worker/worker.js';
import { designBrief, classifyDomain, qaChecklist } from '../worker/design-knowledge.js';
import { buildPalette, paletteBrief } from '../worker/palette.js';
import { exemplarBlock } from '../worker/exemplars.js';
import { motifBlock } from '../worker/motifs.js';
import { cleanBrief } from '../worker/sections.js';
import { fetchSiteHtml, extractFromHtml } from '../worker/extract.js';
import { callClaude } from './claude.js';
import { renderAndCapture } from './render.js';
import { setStatus, setPlan, stepStart, stepDone, fail } from './jobs.js';

const MAX_REVIEWS = 3; // no longer time-boxed to a Worker, so allow more rounds

export async function runJob(job) {
  const { place, branding: bIn, direction: dIn, style: sIn } = job.input;
  const style = sIn === 'clean' ? 'clean' : 'cinematic';
  const direction = (typeof dIn === 'string' ? dIn : '').trim().slice(0, 600);
  const directionBlock = direction
    ? 'USER ART DIRECTION (overrides inferred palette/mood/motif/copy where they conflict; still honour real brand colours + scraped facts):\n' + direction
    : '';
  const dirPrefix = directionBlock ? directionBlock + '\n\n' : '';
  let branding = bIn || {};

  setPlan(job, ['Research', 'Strategy', 'Design', 'Review', 'Deliver']);

  try {
    // ── Research (Phase 1: the client's own site; Phase 3 adds competitors) ──
    setStatus(job, 'researching'); stepStart(job, 'Research');
    const baseUrl = place.website ? (place.website.startsWith('http') ? place.website : 'https://' + place.website) : '';
    const [jinaText, rawHtml] = await Promise.all([
      scrape(place.website).catch(() => ''),
      fetchSiteHtml(place.website).catch(() => ''),
    ]);
    const fromHtml = extractFromHtml(rawHtml, baseUrl);
    let scraped = jinaText;
    if ((fromHtml.voiceText || '').length > (scraped || '').length) scraped = fromHtml.voiceText;
    if (!branding.logoUrl) branding.logoUrl = fromHtml.logoUrl || null;
    let colorSource = (branding.colors && branding.colors.length) ? 'client' : 'none';
    if (!branding.colors || !branding.colors.length) {
      if (fromHtml.colors && fromHtml.colors.length) { branding.colors = fromHtml.colors; colorSource = 'html'; }
    }
    if (!branding.images || !branding.images.length) branding.images = fromHtml.images || [];
    // TODO Phase 3: web_search competitors + fetch several site pages, in parallel.
    const ctx = businessBlock(place, branding, scraped);
    const domain = classifyDomain([place.name, place.category].filter(Boolean).join(' '));
    const brief = designBrief(place, branding);
    const pal = buildPalette(branding.colors, domain, style);
    const palBlock = paletteBrief(pal);
    stepDone(job, 'Research', `domain=${domain} colors=${colorSource} images=${branding.images.length}`);

    // ── Strategy ──
    setStatus(job, 'designing'); stepStart(job, 'Strategy');
    let concept = null, conceptBriefText = '';
    try {
      concept = extractJson(await callClaude(
        conceptSystem(style),
        dirPrefix + ctx + '\n\n' + brief + '\n\n' +
          (style === 'clean' ? cleanBrief(domain) : (exemplarBlock(domain) + '\n\n' + motifBlock(domain))) +
          '\n\nNow decide the strategy. Output only the JSON object.',
        { maxTokens: 2200 }
      ));
      conceptBriefText = conceptBrief(concept, style);
    } catch { /* strategy optional */ }
    stepDone(job, 'Strategy', concept ? `archetype=${concept.archetype}` : 'inline');

    // ── Design / build ──
    stepStart(job, 'Design');
    const sys = style === 'clean' ? cleanSystem() : designSystem();
    const buildText = style === 'clean'
      ? dirPrefix + ctx + '\n\n' + palBlock + '\n\n' + (conceptBriefText ? conceptBriefText + '\n\n' : '') + brief + '\n\n' + cleanBrief(domain) + '\n\nNow build the complete website.'
      : dirPrefix + ctx + '\n\n' + palBlock + '\n\n' + brief + '\n\n' + (conceptBriefText || exemplarBlock(domain)) + '\n\nNow build the complete website' + (conceptBriefText ? ' to this concept.' : '.');
    let html = extractHtml(await callClaude(sys, buildText));
    if (!looksComplete(html)) throw new Error('Design pass produced incomplete HTML.');
    stepDone(job, 'Design');

    // ── QA loop (render → review → re-render) ──
    setStatus(job, 'reviewing'); stepStart(job, 'Review');
    let diag = { frames: [], errors: [], canvasOk: true, rendered: false }, reviews = 0;
    for (let i = 0; i <= MAX_REVIEWS; i++) {
      diag = await renderAndCapture(html).catch(() => ({ frames: [], errors: [], canvasOk: true, rendered: false }));
      const canvasOk = style === 'clean' ? true : diag.canvasOk;
      const ok = canvasOk && (!diag.errors || diag.errors.length === 0);
      if (i > 0 && ok) break;
      if (i === MAX_REVIEWS) break;
      try {
        const reviewed = extractHtml(await callClaude(
          reviewSystem(diag.frames.length > 0, style),
          businessBlock(place, branding, scraped) + '\n\n' + qaChecklist() + renderReport(diag, style) + '\n\nHTML TO IMPROVE:\n' + html,
          { frames: diag.frames }
        ));
        if (looksComplete(reviewed) && reviewed.length > html.length * 0.6) html = reviewed;
        reviews++;
      } catch { break; }
      if (!diag.rendered) break;
    }
    stepDone(job, 'Review', `rounds=${reviews} renderClean=${diag.canvasOk && !diag.errors.length}`);

    // ── Deliver ──
    stepStart(job, 'Deliver');
    html = enforcePalette(html, pal);
    const brandLock = '<style id="brand-lock">' + pal.css + '</style>';
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, brandLock + '</head>') : html.replace(/(<body[^>]*>)/i, brandLock + '$1');
    job.diag = {
      style, archetype: concept?.archetype || null, paletteSource: pal.source,
      palette: pal.vars['--brand'] + '/' + pal.vars['--accent'], colorSource,
      imagesFound: branding.images.length, reviewRounds: reviews,
      renderClean: diag.canvasOk && !diag.errors.length, framesSeen: diag.frames.length,
    };
    job.resultHtml = html;
    stepDone(job, 'Deliver');
    setStatus(job, 'done');
  } catch (e) {
    fail(job, e);
  }
}
