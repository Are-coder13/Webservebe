# Prospector Design Agent (Cloudflare Worker)

This Worker keeps your Anthropic API key **server-side** so it is never exposed in
the public `prospector.html` on GitHub Pages. For each prospect it scrapes their
real website, then runs three Claude passes — a **concept** pass (strategy only),
a **design/build** pass that builds to that locked concept, and a
**vision-in-the-loop review** pass — and returns a tailored design spec that
`prospector.html` renders into the mockup.

The **concept pass** decides the strategy first — the flagship offering, the
feeling, the 3D metaphor (hologram silhouette, light-strand curve, centrepiece),
the chapter storyboard, palette/font choice and language — as structured JSON,
so the build pass spends its budget on flawless execution instead of inventing
the concept and writing correct WebGL in the same breath.

The review is where the agent's judgment sharpens: instead of critiquing the code
blind, it **sees** the generated page. The design-pass HTML is rendered in
Cloudflare Browser Rendering (headless Chromium), screenshotted at several desktop
scroll positions plus a mobile hero, and those frames are handed to Claude so it
can catch what only shows up on screen — blown-out bloom, text drowning in the
glow, an empty hero, a broken mobile layout, a camera that flew inside the geometry
— and fix it. If Browser Rendering is not enabled the review gracefully falls back
to text-only, so nothing breaks.

The design pass is grounded in curated **design intelligence** (`design-knowledge.js`):
the business is classified into a domain (health / auto / beauty / home / food /
general) and a shortlist of matched colour palettes, font pairings, layout
patterns and styles is injected into the prompt; the review pass gets a UX
checklist as a QA gate. That data is extracted from the vendored `ui-ux-pro-max`
skill — regenerate it with `python3 ../scripts/build-design-knowledge.py`.

```
prospector.html (public)  ──POST /──▶  this Worker (holds the key)  ──▶  api.anthropic.com
                                            │
                                            └──▶  r.jina.ai  (scrapes the prospect's site)
```

## One-time deploy

You need a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and Node installed.

```bash
cd worker

# 1. Log in to Cloudflare (opens a browser)
npx wrangler login

# 2. Install dependencies (@cloudflare/puppeteer for the vision pass).
npm install

# 3. Store your Anthropic key as an encrypted secret (paste it when prompted).
#    Get a key at https://console.anthropic.com/ → API keys.
npx wrangler secret put ANTHROPIC_API_KEY

# 4. Deploy
npx wrangler deploy
```

**Browser Rendering (for the vision pass)** needs a **Workers Paid** plan. The
`browser = { binding = "BROWSER" }` line in `wrangler.toml` enables it. On the
free plan, delete that line (or leave it — the pass just no-ops) and the review
runs text-only. The Worker's JSON response includes `framesSeen`: `> 0` confirms
the vision pass ran, `0` means it fell back to text-only.

`wrangler deploy` prints a URL like:

```
https://prospector-designer.<your-subdomain>.workers.dev
```

Copy that URL.

## Connect it to the tool

Open `prospector.html`, click **⚙ Settings**, and paste the Worker URL into the
**Design Agent — Worker URL** field. Save. From then on, **Build Mockup** routes
through the agent. If the field is left blank (or the Worker errors), the tool
falls back to the built-in deterministic template engine, so nothing breaks.

## Cost & latency

Three Claude calls (`claude-opus-4-8`) per mockup — concept + design + review —
plus one scrape and (when Browser Rendering is on) one render. The concept pass
is small; roughly **$0.35–0.80 and ~20–40s per mockup**. Only runs when you click
Build Mockup, so spend tracks exactly the prospects you pursue.

## Updating

Edit `worker.js`, then `npx wrangler deploy` again. To rotate the key:
`npx wrangler secret put ANTHROPIC_API_KEY`.
