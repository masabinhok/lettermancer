// Replays a practice test from its keystrokes and posts ranked tests to the leaderboards.
import { replayPractice } from '../_shared/engine.js';
import { admin, caller, cors, json, rankOn, submitBest } from '../_shared/http.ts';

/** Tests with a leaderboard. */
const RANKED = new Set(['time-15', 'time-60']);
const MIN_ACCURACY = 0.9;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const user = await caller(req);
  if (!user) return json({ error: 'Sign in to submit results.' }, 401);

  let body: { config?: unknown; inputs?: unknown; trial?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  if (!body.config || !Array.isArray(body.inputs) || body.inputs.length > 20_000)
    return json({ error: 'Send { config, inputs }.' }, 400);

  // deno-lint-ignore no-explicit-any
  const result = replayPractice(body.config as any, body.inputs as any);
  if (!result) return json({ ok: false, reason: 'the keystrokes do not complete the test' }, 422);

  const db = admin();
  const { error } = await db.from('practice_results').insert({
    user_id: user.id,
    test_id: result.testId,
    wpm: result.wpm,
    raw: result.raw,
    accuracy: result.accuracy,
    consistency: result.consistency,
    seconds: result.seconds,
    trial: typeof body.trial === 'string' ? body.trial : null,
    verified: true,
  });
  if (error) return json({ error: error.message }, 500);

  if (!RANKED.has(result.testId) || result.accuracy < MIN_ACCURACY) return json({ ok: true, result, ranked: false });
  const board = `practice:${result.testId}`;
  const r = await submitBest(db, board, user.id, result.wpm, { accuracy: result.accuracy }, null);
  return json({ ok: true, result, ranked: true, standing: { ...r, rank: await rankOn(db, board, user.id) } });
});
