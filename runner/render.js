// Native Playwright rendering — the runner's "hand" for the vision/QA loop.
// Replaces the Cloudflare Browser Rendering dependency entirely, so the loop is
// always available (no paid plan, no framesSeen=0). Captures frames + runtime
// errors + a canvas-health check, mirroring worker/screenshot.js.

import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DESKTOP = [0, 0.34, 0.68, 1];

export async function renderAndCapture(html) {
  const out = { frames: [], errors: [], canvasOk: true, rendered: false };
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
    page.on('pageerror', (e) => out.errors.length < 8 && out.errors.push(String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error' && out.errors.length < 8) out.errors.push(m.text().slice(0, 300)); });

    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2600);

    out.canvasOk = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? (c.width > 0 && c.height > 0) : false;
    }).catch(() => true);

    for (const f of DESKTOP) {
      await page.evaluate((frac) => {
        const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.scrollTo(0, Math.round(frac * Math.max(0, h - window.innerHeight)));
      }, f);
      await sleep(1400);
      const buf = await page.screenshot({ type: 'jpeg', quality: 72 });
      out.frames.push({ label: `desktop @ ${Math.round(f * 100)}% scroll`, data: buf.toString('base64') });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1400);
    const m = await page.screenshot({ type: 'jpeg', quality: 72 });
    out.frames.push({ label: 'mobile hero @ 390px', data: m.toString('base64') });

    out.rendered = true;
    return out;
  } catch (e) {
    out.errors.push(String((e && e.message) || e).slice(0, 300));
    out.canvasOk = false;
    return out;
  } finally {
    try { if (browser) await browser.close(); } catch { /* ignore */ }
  }
}
