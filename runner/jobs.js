// In-memory job store (Phase 1). Swap for Postgres/Redis in Phase 5 — the API
// below is all the rest of the code depends on, so the swap is localized.
//
// A job carries the live to-do plan and a progress log so the front-end can
// poll and render a Manus-style checklist while the orchestrator works.

import { randomUUID } from 'node:crypto';

const jobs = new Map();

export function createJob(input) {
  const id = randomUUID();
  const job = {
    id,
    createdAt: Date.now(),
    status: 'queued', // queued → planning → researching → designing → reviewing → done | error
    input,            // { place, branding, direction, style, goal }
    plan: [],         // [{ id, title, status: pending|active|done }]
    progress: [],     // [{ ts, step, status, note }]
    resultHtml: null,
    diag: null,
    error: null,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id) { return jobs.get(id) || null; }

// Public (poll) view — omit the raw input, keep everything the UI shows.
export function publicView(job) {
  if (!job) return null;
  const { input, ...rest } = job;
  return { ...rest, style: input?.style || 'cinematic' };
}

export function nextQueued() {
  for (const job of jobs.values()) if (job.status === 'queued') return job;
  return null;
}

// ── progress helpers the orchestrator calls ────────────────────────────────
export function setStatus(job, status) { job.status = status; }

export function setPlan(job, steps) {
  job.plan = steps.map((title, i) => ({ id: i + 1, title, status: 'pending' }));
}

export function stepStart(job, title) {
  const s = job.plan.find((p) => p.title === title);
  if (s) s.status = 'active';
  job.progress.push({ ts: Date.now(), step: title, status: 'active', note: '' });
}

export function stepDone(job, title, note = '') {
  const s = job.plan.find((p) => p.title === title);
  if (s) s.status = 'done';
  job.progress.push({ ts: Date.now(), step: title, status: 'done', note });
}

// Index-based advance — used when step titles are dynamic (planner-generated).
export function stepAt(job, i, status, note = '') {
  const s = job.plan[i];
  if (s) s.status = status;
  job.progress.push({ ts: Date.now(), step: (s && s.title) || ('step ' + i), status, note });
}

export function fail(job, err) {
  job.status = 'error';
  job.error = String((err && err.message) || err);
  job.progress.push({ ts: Date.now(), step: 'error', status: 'error', note: job.error });
}

// Reap old jobs so the map doesn't grow forever (1h TTL).
setInterval(() => {
  const cutoff = Date.now() - 3600_000;
  for (const [id, job] of jobs) if (job.createdAt < cutoff) jobs.delete(id);
}, 600_000).unref?.();
