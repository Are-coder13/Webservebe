// Claude call for the runner — non-streaming (jobs are async, we don't need to
// stream to a live HTTP response) with the same transient-retry policy as the
// Worker. `frames` are optional base64 jpegs for the vision review.

import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function callClaude(system, userText, { frames = null, maxTokens = 32000 } = {}) {
  const content = [];
  if (frames && frames.length) {
    for (const f of frames) {
      content.push({ type: 'text', text: `Screenshot — ${f.label}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.data } });
    }
  }
  content.push({ type: 'text', text: userText });

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1000 * attempt);
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content }],
      });
      return (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    } catch (e) {
      lastErr = e;
      const s = e && e.status;
      const transient = !s || [408, 409, 429, 500, 502, 503, 529].includes(s);
      if (!transient) throw e;
    }
  }
  throw lastErr || new Error('Claude request failed after retries');
}
