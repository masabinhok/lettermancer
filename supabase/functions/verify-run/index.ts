// Replays a submitted run with the game engine. Honest, finished runs are stored as verified and
// posted to the leaderboards; anything else is refused with a reason.
import { dailyLabel, heat, verifyRun, weeklyLabel } from '../_shared/engine.js';
import { admin, caller, cors, json, rankOn, submitBest } from '../_shared/http.ts';

const MAX_ACTIONS = 200_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const user = await caller(req);
  if (!user) return json({ error: 'Sign in to submit runs.' }, 401);

  let body: { config?: unknown; actions?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  if (!body.config || !Array.isArray(body.actions) || body.actions.length > MAX_ACTIONS)
    return json({ error: 'Send { config, actions }.' }, 400);

  const now = new Date();
  // deno-lint-ignore no-explicit-any
  const verdict = verifyRun(body.config as any, body.actions as any, now);
  if (!verdict.ok) return json({ ok: false, reason: verdict.reason }, 422);

  const { machine, score } = verdict;
  const run = machine.run;
  const t = run.totals;
  const db = admin();

  // The daily counts once: it must have been claimed at the start, and the claim must still be open.
  const day = now.toISOString().slice(0, 10);
  if (machine.config.mode === 'daily') {
    const { data: entry } = await db
      .from('daily_entries')
      .select('run_id')
      .eq('user_id', user.id)
      .eq('day', day)
      .maybeSingle();
    if (!entry) return json({ ok: false, reason: 'start the daily while signed in to rank it' }, 422);
    if (entry.run_id !== null) return json({ ok: false, reason: 'you already played today’s daily' }, 422);
  }
  const { data: row, error } = await db
    .from('runs')
    .insert({
      user_id: user.id,
      seed: machine.config.seed,
      starter: machine.config.starter,
      mode: machine.config.mode,
      heat: heat(machine.config.oaths),
      gentle: false,
      result: run.result,
      act: run.act,
      score,
      words: t.words,
      max_combo: t.maxCombo,
      peak_wpm: t.peakWpm,
      accuracy: t.correct + t.errors ? t.correct / (t.correct + t.errors) : 0,
      report: machine.report,
      replay: { config: machine.config, actions: body.actions },
      verified: true,
    })
    .select('id')
    .single();
  if (error) return json({ error: error.message }, 500);

  if (machine.config.mode === 'daily') {
    // Close the claim; if another submission beat us to it, this one doesn't count.
    const { data: closed } = await db
      .from('daily_entries')
      .update({ run_id: row.id })
      .eq('user_id', user.id)
      .eq('day', day)
      .is('run_id', null)
      .select('day');
    if (!closed?.length) return json({ ok: false, reason: 'you already played today’s daily' }, 422);
  }

  const detail = {
    result: run.result,
    act: run.act,
    heat: heat(machine.config.oaths),
    starter: machine.config.starter,
  };
  const boards = ['all-time'];
  if (machine.config.mode === 'daily') boards.push(dailyLabel(now));
  if (machine.config.mode === 'weekly') boards.push(weeklyLabel(now));
  const standings: Record<string, { best: number; improved: boolean; rank: number | null }> = {};
  for (const board of boards) {
    const r = await submitBest(db, board, user.id, score, detail, row.id);
    standings[board] = { ...r, rank: await rankOn(db, board, user.id) };
  }
  // The Oath board: the highest Heat a player has won at.
  const runHeat = heat(machine.config.oaths);
  if (run.result === 'won' && runHeat > 0) {
    const r = await submitBest(db, 'heat', user.id, runHeat, detail, row.id);
    standings.heat = { ...r, rank: await rankOn(db, 'heat', user.id) };
  }
  return json({ ok: true, runId: row.id, score, standings });
});
