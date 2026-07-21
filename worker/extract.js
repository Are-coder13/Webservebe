// Browser-free extraction of the client's real branding + content.
//
// The previous brand/logo/colour extraction (screenshot.js:extractSiteBrand)
// only ran when Cloudflare Browser Rendering was enabled — so on the free plan
// it silently returned nothing and mockups came out untailored. This module
// works on ANY plan: a plain fetch() of the client site + a dependency-free
// parse for the logo, brand colours and voice text. Browser Rendering then
// becomes an optional enhancement (pixel-accurate logo colours), not a
// requirement.

// Fetch the raw HTML of the client site. Most local-business sites are
// server-rendered, so this yields real markup (logo, meta, copy). Never throws.
export async function fetchSiteHtml(website) {
  if (!website) return '';
  try {
    const target = website.startsWith('http') ? website : 'https://' + website;
    const r = await fetch(target, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    });
    if (!r.ok) return '';
    const ct = r.headers.get('content-type') || '';
    if (!/html/i.test(ct)) return '';
    return (await r.text()).slice(0, 400000);
  } catch { return ''; }
}

const abs = (u, base) => { try { return new URL(u, base).href; } catch { return u || null; } };

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  return m ? (m[2] || m[3] || m[4] || '') : '';
}

// Keep only saturated, non-grey, non-near-white/black colours (brand hues).
function keepBrandHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = m[1];
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx > 236 && mn > 236) return null;   // near-white
  if (mx < 24) return null;                // near-black
  if (mx - mn < 16) return null;           // near-grey
  return '#' + n.toLowerCase();
}

/**
 * Parse raw HTML → { logoUrl, colors[], voiceText }. Regex-based, no deps, safe
 * in a Worker. Best-effort: returns whatever it can find.
 */
export function extractFromHtml(html, baseUrl) {
  const out = { logoUrl: null, colors: [], voiceText: '' };
  if (!html) return out;

  // ---- logo ----
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  let logo = null;
  // 1) an <img> whose class/alt/id/src mentions "logo"
  for (const t of imgTags) {
    if (/logo/i.test(t)) { const s = attr(t, 'src') || attr(t, 'data-src'); if (s) { logo = s; break; } }
  }
  // 2) first <img> inside a header/nav region
  if (!logo) {
    const head = html.match(/<(header|nav)\b[^>]*>[\s\S]{0,4000}?<\/\1>/i);
    if (head) { const it = head[0].match(/<img\b[^>]*>/i); if (it) logo = attr(it[0], 'src') || attr(it[0], 'data-src'); }
  }
  // 3) fallbacks: og:image, apple-touch-icon, icon
  if (!logo) {
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i);
    if (og) logo = attr(og[0], 'content');
  }
  if (!logo) {
    const link = html.match(/<link[^>]+rel=["'][^"']*(?:apple-touch-icon|icon)[^"']*["'][^>]*>/i);
    if (link) logo = attr(link[0], 'href');
  }
  if (logo) out.logoUrl = abs(logo, baseUrl);

  // ---- colours ----
  const colors = [];
  const push = (hex) => { const h = hex && keepBrandHex(hex); if (h && !colors.includes(h)) colors.push(h); };
  // theme-color meta (highest signal)
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]*>/i);
  if (theme) push(attr(theme[0], 'content'));
  // CSS custom properties that look brand-ish (--brand / --primary / --accent / --color-primary …)
  const varRe = /--(?:brand|primary|accent|main|theme|color-primary|primary-color)[a-z0-9-]*\s*:\s*(#[0-9a-fA-F]{6})/gi;
  let vm; while ((vm = varRe.exec(html)) && colors.length < 6) push(vm[1]);
  // any hex in inline styles / <style> as a last resort, most frequent first
  if (colors.length < 2) {
    const freq = {};
    const hexRe = /#[0-9a-fA-F]{6}\b/g; let hm;
    while ((hm = hexRe.exec(html))) { const h = keepBrandHex(hm[0]); if (h) freq[h] = (freq[h] || 0) + 1; }
    Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).forEach(([h]) => push(h));
  }
  out.colors = colors.slice(0, 4);

  // ---- voice / content text ----
  const pick = (re) => { const m = html.match(re); return m ? attr(m[0], 'content') : ''; };
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].trim();
  const desc = pick(/<meta[^>]+name=["']description["'][^>]*>/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]*>/i);
  const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]*>/i);
  // strip scripts/styles then tags → visible text
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  out.voiceText = [title, ogTitle, desc, ogDesc, body].filter(Boolean).join('\n').slice(0, 4000);
  return out;
}
