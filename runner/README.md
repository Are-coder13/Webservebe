# prospector-runner — async "Manus for websites" orchestrator

Persistent Node service that runs the multi-agent website-build loop **off** the
Cloudflare Worker's time limit (Option C). The Worker stays a thin edge API and
forwards jobs here; this service owns the job store, runs the orchestrator
async, and renders with native Playwright (no Cloudflare Browser Rendering
dependency).

## What it does (per job)
Research → Strategy → Design → Review (render→fix loop) → Deliver, emitting a
live to-do plan + progress the front-end polls. It **reuses the Worker's exact
prompt builders** (imported from `../worker/worker.js` — one brain, no
duplication) plus the shared modules (`palette.js`, `extract.js`, `sections.js`,
`motifs.js`, `exemplars.js`, `design-knowledge.js`).

## Run locally
```bash
cd runner
npm install
npx playwright install chromium
ANTHROPIC_API_KEY=sk-... SHARED_SECRET=dev PORT=8787 npm start
```

## API (auth: `x-runner-secret: $SHARED_SECRET`)
- `POST /jobs`  `{ place, branding, direction, style }` → `{ jobId }`
- `GET  /jobs/:id` → `{ status, plan[], progress[], resultHtml, diag }`
- `GET  /healthz`

## Deploy
Any always-on Node host (Railway / Render / Fly / a VPS / Cloudflare Containers).
Set `ANTHROPIC_API_KEY`, `SHARED_SECRET`, optional `CLAUDE_MODEL`, `PORT`.
Dockerfile should `npx playwright install --with-deps chromium`.

## Status
- ✅ Phase 1 core: async job model, orchestrator (mirrors the Worker pipeline),
  Playwright rendering, retрy'd Claude calls, live plan/progress.
- ⬜ Remaining Phase 1 wiring: Worker `POST /jobs` + `GET /jobs/:id` forward
  endpoints, and `prospector.html` enqueue-then-poll (with the to-do checklist UI).
- ⬜ Phase 2 planner sub-agent · Phase 3 competitor `web_search` research ·
  Phase 4 parallel sub-agents · Phase 5 durable job store (Postgres/Redis).

See `../docs/manus-for-websites-plan.md` for the full plan.
