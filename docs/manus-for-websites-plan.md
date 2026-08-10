# "Manus for Websites" — Build Plan (Option C)

## Goal
Clicking **Build Mockup** kicks off a full agentic loop — an orchestrator that
plans, researches, designs, self-reviews and delivers a finished, tailored
website — running **asynchronously** with a live to-do plan, exactly like Manus,
but scoped to website building.

## Why Option C (Worker front + async Agent SDK runner)
A Cloudflare Worker can't run a minutes-long multi-agent loop (no persistent
process, hard time limit) — that's the cause of the current timeouts. So we
split responsibilities:

```
prospector.html ──POST /jobs──▶  Worker (edge API: CORS, auth, key custody)
      ▲  (poll GET /jobs/:id)         │  forwards to runner
      │                               ▼
      └──────────────── Runner: persistent Node service (Claude Agent SDK)
                        • owns the job store (Postgres/Redis)
                        • runs the orchestrator loop async (minutes)
                        • renders with Playwright (native — no Cloudflare
                          Browser Rendering needed, removes the paid dependency)
                        • writes progress + final HTML back to the store
```

The Worker stays thin (the tool keeps pointing at the same Worker URL — no
front-end config change). All the heavy, long-running work moves to the runner.
**The Agent SDK IS the Manus engine** — we host Claude-in-a-loop, not reinvent it.

## Components

### 1. Runner — persistent Node service (the core new build)
- Host: **Railway or Render** (simplest Node + Playwright), or Fly.io / a VPS /
  Cloudflare Containers. Always-on, can run for minutes.
- Stack: Node + Express (tiny API) + **@anthropic-ai/claude-agent-sdk** + Playwright.
- Endpoints (called only by the Worker, shared-secret auth):
  - `POST /jobs` → create job {id, status:'queued', input}, return id.
  - `GET /jobs/:id` → {status, plan[], progress[], resultHtml, diag}.
- A worker loop drains queued jobs and runs the **orchestrator** (below).
- Job store: **Postgres** (Supabase/Neon) or **Upstash Redis**. Holds job state,
  the live to-do plan, per-step progress, and the final HTML.

### 2. Worker — edge API (mostly repurposed from current worker.js)
- `POST /jobs`: validate input (place, branding, direction, style, goal), forward
  to runner `/jobs`, return {jobId}. Adds CORS + rate limiting + hides runner URL.
- `GET /jobs/:jobId`: forward to runner, return status/plan/progress/result.
- Keeps the Anthropic key OR delegates model calls to the runner (runner holds
  its own key; Worker just guards access). Old synchronous `POST /` can stay as a
  fallback during migration.

### 3. Front-end — prospector.html (incremental)
- `buildMockup()` → `POST /jobs` → get jobId → **poll** `GET /jobs/:jobId` every
  ~2s.
- Result modal shows a **live to-do checklist** (the plan) with per-step status
  (planning → researching → designing → reviewing → done) — the Manus feel.
- On `done`, render the HTML + push to GitHub as today. `direction`/`style`
  inputs already exist and pass straight through.

## The orchestrator (Agent SDK, on the runner)
A central agent that plans, then delegates to sub-agents, emitting progress after
every step so the UI shows live state.

**Tools the agent gets** (each also usable deterministically):
- `fetch_page(url)` — raw HTML of a page (research).
- `web_search(query)` — competitor/industry research (Brave/SerpAPI/Bing key).
- `extract_brand(url)` — logo + colours + copy (reuse `extract.js`).
- `render_and_capture(html)` — Playwright: screenshots + console/errors + canvas
  health (reuse `screenshot.js` logic, native Playwright).
- `build_palette` / `enforce_palette` — deterministic colour (reuse `palette.js`).
- `emit_plan(steps[])` / `emit_progress(step,status,note)` — write to job store.

**Sub-agents / phases** (orchestrator runs them, some in parallel):
1. **Planner** → emits the to-do list for this specific job.
2. **Research** (parallel) → browse several of the prospect's pages + 1–2
   competitors; gather real services, products, tone, imagery, positioning.
   (Deeper than today's single-page scrape.)
3. **Strategy** → the existing strategy pass (archetype, hero, products, 3D/clean
   concept, palette, voice) — now fed by real research.
4. **Design/Build** → existing `designSystem`/`cleanSystem` build.
5. **QA loop** → `render_and_capture` → review → re-render until clean
   (the loop we already have, now with native Playwright + more rounds allowed
   since we're not time-boxed).
6. **Deliver** → final HTML + BUILD DIAG + palette lock (reuse `enforcePalette`).

## What's reused vs new
- **Reused almost verbatim** (they're plain JS modules → move into the runner):
  `palette.js`, `extract.js`, `sections.js`, `motifs.js`, `exemplars.js`,
  `design-knowledge.js`, `three-recipes.js`, and all the prompt builders
  (`designSystem`, `cleanSystem`, `conceptSystem`, `reviewSystem`, `enforcePalette`).
- **New**: the runner service, the job model + store, the orchestrator/tool loop
  (Agent SDK), `web_search` + multi-page research, Playwright rendering, and the
  front-end polling + progress UI.

## Job/data model
```
Job { id, createdAt, status: queued|planning|researching|designing|reviewing|done|error,
      input: {place, branding, direction, style, goal},
      plan: [{id, title, status}],
      progress: [{ts, step, status, note}],
      resultHtml, diag: {archetype, paletteSource, palette, imagesFound, reviewRounds, renderClean},
      error }
```

## Phased delivery (ship value early)
- **Phase 0** — extract the shared prompt/logic modules so they import cleanly in
  a Node service (they already do; verify no Worker-only APIs).
- **Phase 1** — stand up the runner + job model + move the CURRENT pipeline
  (strategy→build→review) into it, async, with polling. Worker forwards. This
  alone removes the timeout/fallback problem.
- **Phase 2** — add the orchestrator + planner + live progress (the to-do UI).
- **Phase 3** — add the research phase (multi-page + competitor `web_search`).
- **Phase 4** — front-end progress checklist polish; parallel sub-agents.
- **Phase 5** — Playwright rendering replaces Cloudflare Browser Rendering
  everywhere (vision loop always on, no paid dependency).

## Deploy / secrets
- Runner env: `ANTHROPIC_API_KEY`, `SEARCH_API_KEY`, `DB_URL`, `SHARED_SECRET`.
- Worker env: `RUNNER_URL`, `SHARED_SECRET` (+ existing).
- Playwright: runner Dockerfile installs Chromium.

## Verification
1. Enqueue a job → `GET /jobs/:id` shows status advancing through the plan.
2. A build that would exceed Worker limits now completes (no timeout/fallback).
3. Research phase visibly pulls real services/products/competitor cues into the
   strategy (check `diag` + copy).
4. QA loop runs 2–4 rounds with Playwright; `renderClean:true`.
5. Front-end shows the live to-do checklist and the finished mockup on `done`.

## Honest risks / costs
- This is a **real rebuild** (a new always-on service + async model + front-end
  polling), not a patch — multiple sessions.
- **Cost/latency per mockup rises** (more calls, minutes-long) — fine for a
  "come back when done" async UX, but not free; add per-job cost caps.
- A persistent host + DB is **new infra to run and pay for** (small, but real).
- Do the build in a **fresh session** (this one's git write access is revoked).
