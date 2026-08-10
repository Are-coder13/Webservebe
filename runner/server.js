// Runner API + async job loop. The Cloudflare Worker forwards enqueue/poll here
// (shared-secret auth); this service owns the job store and runs the
// orchestrator off the Worker's time limit.
//
//   POST /jobs        → { jobId }         (enqueue; returns immediately)
//   GET  /jobs/:id    → public job view   (front-end polls this)
//   GET  /healthz     → ok
//
// Auth: every request must send  x-runner-secret: $SHARED_SECRET.

import express from 'express';
import { createJob, getJob, publicView, nextQueued, setStatus } from './jobs.js';
import { runJob } from './orchestrator.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

const SECRET = process.env.SHARED_SECRET || '';
app.use((req, res, next) => {
  if (req.path === '/healthz') return next();
  if (SECRET && req.get('x-runner-secret') !== SECRET) return res.status(401).json({ error: 'unauthorized' });
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/jobs', (req, res) => {
  const { place } = req.body || {};
  if (!place || !place.name) return res.status(400).json({ error: 'place.name is required' });
  const job = createJob(req.body);
  res.json({ jobId: job.id, status: job.status });
});

app.get('/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(publicView(job));
});

// Single-concurrency worker loop (Phase 1). Bump to a small pool later.
async function loop() {
  const job = nextQueued();
  if (job) {
    setStatus(job, 'planning');
    try { await runJob(job); } catch (e) { console.error('runJob crashed', e); }
  }
  setTimeout(loop, job ? 100 : 1500);
}
loop();

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`prospector-runner listening on :${PORT}`));
