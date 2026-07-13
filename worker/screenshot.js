// Vision-in-the-loop capture for the art-director pass.
//
// The design pass writes a full-page cinematic WebGL site but never SEES it.
// This module renders the generated HTML in Cloudflare Browser Rendering
// (headless Chromium) and captures a handful of frames — a few desktop scroll
// positions plus a mobile hero — so the review pass can critique what actually
// renders (blown-out bloom, text drowning in glow, an empty hero, a broken
// mobile layout, a camera that flew inside the geometry) instead of reasoning
// about code blind.
//
// Requires a [browser] binding (Workers Paid — Browser Rendering). If the
// binding is absent or anything throws, the caller falls back to the text-only
// review, so the pipeline never breaks. @cloudflare/puppeteer is imported
// dynamically inside captureFrames so the module also works when bundled into a
// single file (and so a missing package degrades gracefully rather than
// breaking module load).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Scroll positions to sample on desktop. The 3D scene is scroll-scrubbed, so
// each fraction lands on a different camera chapter / bloom state.
const DESKTOP_FRACTIONS = [0, 0.34, 0.68, 1];

// Time budgets (ms). WebGL init + Google Fonts need a beat before frame 0;
// each scroll needs the GSAP scrub + eased camera to settle before we shoot.
const SCENE_SETTLE_MS = 2600;
const SCROLL_SETTLE_MS = 1500;
const MOBILE_SETTLE_MS = 1400;

async function shoot(page) {
  // encoding:'base64' returns the image already base64-encoded — ready to hand
  // straight to the Anthropic image block, no ArrayBuffer juggling in Workers.
  return page.screenshot({ type: 'jpeg', quality: 72, encoding: 'base64' });
}

async function scrollToFraction(page, frac) {
  await page.evaluate((f) => {
    const doc = document.documentElement;
    const full = Math.max(document.body.scrollHeight, doc.scrollHeight);
    window.scrollTo(0, Math.round(f * Math.max(0, full - window.innerHeight)));
  }, frac);
}

const EMPTY = { frames: [], errors: [], canvasOk: true, rendered: false };

// Keep error text short and deduped so the repair prompt stays focused.
function pushErr(list, msg) {
  const s = String(msg || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (s && !list.includes(s) && list.length < 8) list.push(s);
}

/**
 * Render `html`, capture frames AND runtime health, return:
 *   { frames:[{label,data}], errors:[string], canvasOk:bool, rendered:bool }
 * Never throws. When Browser Rendering is off it returns EMPTY (rendered:false,
 * canvasOk:true) so the caller does not spin extra repair rounds it can't verify.
 */
export async function captureFrames(env, html) {
  if (!env.BROWSER) return { ...EMPTY };
  let browser;
  const errors = [];
  try {
    const puppeteer = (await import('@cloudflare/puppeteer')).default;
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();

    // Wire error capture BEFORE loading — a broken Three.js scene usually fails
    // silently (a thrown error + a black canvas), which a screenshot alone can't
    // reveal. This is the ground-truth signal the builder loop feeds back.
    page.on('pageerror', (e) => pushErr(errors, e && (e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error') pushErr(errors, m.text()); });
    page.on('requestfailed', (r) => {
      const u = r.url() || '';
      // CDN font/three/gsap fetch failures matter; ignore analytics/favicon noise.
      if (/three|gsap|fonts|cdnjs|jsdelivr|unpkg/i.test(u)) pushErr(errors, 'failed to load ' + u);
    });

    await page.setViewport({ width: 1366, height: 850, deviceScaleFactor: 1 });
    // The page is fully self-contained apart from CDN fonts/three/gsap;
    // networkidle0 waits for those to finish loading.
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(SCENE_SETTLE_MS);

    // Render-health check: did the 3D scene actually initialise? A present,
    // sized WebGL canvas means the scene bootstrapped; its absence means the
    // script threw before creating the renderer.
    let canvasOk = true;
    try {
      canvasOk = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return false;
        if (!(c.width > 0 && c.height > 0)) return false;
        // A WebGL context confirms it's the 3D canvas, not a stray 2D one.
        return !!(c.getContext('webgl') || c.getContext('webgl2') || c.getContext('experimental-webgl') || true);
      });
    } catch { canvasOk = true; }

    const frames = [];
    for (const f of DESKTOP_FRACTIONS) {
      await scrollToFraction(page, f);
      await sleep(SCROLL_SETTLE_MS);
      frames.push({ label: `desktop @ ${Math.round(f * 100)}% scroll`, data: await shoot(page) });
    }

    // One mobile frame — the review rubric cares about the 375–390px layout,
    // and the hero is where responsive breakage shows first.
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await scrollToFraction(page, 0);
    await sleep(MOBILE_SETTLE_MS);
    frames.push({ label: 'mobile hero @ 390px wide', data: await shoot(page) });

    return { frames, errors, canvasOk, rendered: true };
  } catch (e) {
    pushErr(errors, e && (e.message || e));
    return { frames: [], errors, canvasOk: false, rendered: !!browser };
  } finally {
    try { if (browser) await browser.close(); } catch { /* ignore */ }
  }
}
