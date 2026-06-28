# Prospector Design Agent (Cloudflare Worker)

This Worker keeps your Anthropic API key **server-side** so it is never exposed in
the public `prospector.html` on GitHub Pages. For each prospect it scrapes their
real website, runs a Claude **design** pass and a **review** pass, and returns a
tailored design spec that `prospector.html` renders into the mockup.

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

# 2. Store your Anthropic key as an encrypted secret (paste it when prompted).
#    Get a key at https://console.anthropic.com/ → API keys.
npx wrangler secret put ANTHROPIC_API_KEY

# 3. Deploy
npx wrangler deploy
```

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

Two Claude calls (`claude-opus-4-8`) per mockup — design + review — plus one
scrape. Roughly **$0.30–0.70 and ~15–30s per mockup**. Only runs when you click
Build Mockup, so spend tracks exactly the prospects you pursue.

## Updating

Edit `worker.js`, then `npx wrangler deploy` again. To rotate the key:
`npx wrangler secret put ANTHROPIC_API_KEY`.
