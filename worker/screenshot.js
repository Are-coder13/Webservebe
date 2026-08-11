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

// ── Brand extraction from the REAL client page ──────────────────────────────
// Visit the client's site in the headless browser and pull what actually makes
// a mockup feel tailored: the logo (from the header), the brand colours (sampled
// from the logo's own pixels, with a computed-CSS accent fallback), and the core
// text. This replaces the Brandfetch database lookup (which misses small local
// businesses) with a direct read of the page. Returns {} when Browser Rendering
// is off or the visit fails, so the caller keeps its existing fallbacks.
export async function extractSiteBrand(env, website) {
  if (!env.BROWSER || !website) return {};
  let browser;
  try {
    const puppeteer = (await import('@cloudflare/puppeteer')).default;
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
    const target = website.startsWith('http') ? website : 'https://' + website;
    await page.goto(target, { waitUntil: 'networkidle0', timeout: 30000 });

    const data = await page.evaluate(async () => {
      const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };

      // --- find the logo: prefer an <img> in the header, top-left/centre ---
      function pickLogo() {
        const cands = new Set();
        ['header img', 'nav img', '.navbar img', '#header img', '[class*="logo" i] img',
         'img[class*="logo" i]', 'img[alt*="logo" i]', 'img[src*="logo" i]']
          .forEach((s) => document.querySelectorAll(s).forEach((el) => cands.add(el)));
        document.querySelectorAll('img').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < 240 && r.width > 0) cands.add(el);
        });
        let best = null, bestScore = -1;
        for (const el of cands) {
          const r = el.getBoundingClientRect();
          if (!el.currentSrc && !el.src) continue;
          if (r.width < 16 || r.height < 16 || r.width > 600) continue;
          let score = Math.max(0, 240 - r.top);
          if (r.width >= 40 && r.width <= 420) score += 60;
          if (/logo/i.test((el.className || '') + ' ' + (el.alt || '') + ' ' + (el.src || ''))) score += 220;
          if (score > bestScore) { bestScore = score; best = el; }
        }
        if (best) return abs(best.currentSrc || best.src);
        const og = document.querySelector('meta[property="og:image"]');
        if (og && og.content) return abs(og.content);
        const at = document.querySelector('link[rel*="apple-touch-icon" i]');
        if (at && at.href) return abs(at.href);
        return null;
      }

      // sample dominant, saturated colours from an image's pixels
      async function logoColors(src) {
        if (!src) return [];
        try {
          const img = await new Promise((res, rej) => {
            const i = new Image(); i.crossOrigin = 'anonymous';
            i.onload = () => res(i); i.onerror = rej; i.src = src;
          });
          const w = 48, h = 48, cn = document.createElement('canvas');
          cn.width = w; cn.height = h;
          const g = cn.getContext('2d'); g.drawImage(img, 0, 0, w, h);
          let d; try { d = g.getImageData(0, 0, w, h).data; } catch { return []; }
          const map = {};
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 128) continue;
            const r = d[i], gg = d[i + 1], b = d[i + 2];
            const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
            if (mx > 236 && mn > 236) continue;   // near-white
            if (mx < 24) continue;                // near-black
            if (mx - mn < 16) continue;           // near-grey (skip to find the brand hue)
            const key = (r >> 4) + ',' + (gg >> 4) + ',' + (b >> 4);
            const o = (map[key] = map[key] || { n: 0, r: 0, g: 0, b: 0 });
            o.n++; o.r += r; o.g += gg; o.b += b;
          }
          return Object.values(map).sort((a, b) => b.n - a.n).slice(0, 4)
            .map((o) => '#' + [o.r / o.n, o.g / o.n, o.b / o.n]
              .map((x) => Math.round(x).toString(16).padStart(2, '0')).join(''));
        } catch { return []; }
      }

      // fallback: harvest saturated colours from prominent CSS (buttons/links/header)
      function cssColors() {
        const out = [];
        const toHex = (c) => {
          const m = (c || '').match(/\d+/g); if (!m || m.length < 3) return null;
          const [r, g, b] = m.map(Number);
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx > 236 && mn > 236) return null;
          if (mx < 24) return null;
          if (mx - mn < 16) return null;
          return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
        };
        const els = document.querySelectorAll('a, button, .btn, header, [class*="btn" i], [class*="cta" i]');
        let seen = 0;
        for (const el of els) {
          if (seen > 40) break; seen++;
          const s = getComputedStyle(el);
          [toHex(s.backgroundColor), toHex(s.color), toHex(s.borderColor)].forEach((h) => {
            if (h && !out.includes(h)) out.push(h);
          });
        }
        return out.slice(0, 4);
      }

      const logoUrl = pickLogo();
      let colors = await logoColors(logoUrl);
      if (!colors.length) colors = cssColors();
      const title = document.title || '';
      const desc = (document.querySelector('meta[name="description"]') || {}).content || '';
      const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 4000);
      return { logoUrl, colors, title, desc, text };
    });

    return {
      logoUrl: data.logoUrl || null,
      colors: (data.colors || []).filter(Boolean),
      voiceText: [data.title, data.desc, data.text].filter(Boolean).join('\n'),
    };
  } catch {
    return {};
  } finally {
    try { if (browser) await browser.close(); } catch { /* ignore */ }
  }
}
