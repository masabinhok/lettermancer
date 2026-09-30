/**
 * Cloud tests against a local Supabase (`npx supabase start` + `npx supabase functions serve`).
 * Run with: npm run test:cloud
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createPractice,
  makeRng,
  newRunConfig,
  playRun,
  pressPractice,
  sharedRunConfig,
  type Action,
} from '@keycraft/engine';
import { beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const FN = `${URL}/functions/v1`;
// Unique per run, so the tests pass against a database that already has players.
const NAME = `quill_${Date.now() % 1_000_000}`;

async function newPlayer(): Promise<{ db: SupabaseClient; id: string; token: string }> {
  const db = createClient(URL, ANON, { auth: { persistSession: false } });
  const email = `p${Date.now()}${Math.floor(Math.random() * 1e6)}@keycraft.test`;
  const { data, error } = await db.auth.signUp({ email, password: 'test-password-123' });
  if (error) throw error;
  return { db, id: data.user!.id, token: data.session!.access_token };
}

const call = (name: string, token: string | null, body: unknown) =>
  fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

let a: Awaited<ReturnType<typeof newPlayer>>;
let b: Awaited<ReturnType<typeof newPlayer>>;

beforeAll(async () => {
  a = await newPlayer();
  b = await newPlayer();
});

describe('row-level security', () => {
  it('creates a profile for every new account, readable by all', async () => {
    const { data } = await b.db.from('profiles').select('id').eq('id', a.id).single();
    expect(data?.id).toBe(a.id);
  });

  it('keeps progress private to its owner', async () => {
    await a.db.from('progress').upsert({ user_id: a.id, meta: { ink: 5 } });
    const mine = await a.db.from('progress').select('meta').eq('user_id', a.id);
    expect(mine.data).toHaveLength(1);
    const theirs = await b.db.from('progress').select('meta').eq('user_id', a.id);
    expect(theirs.data).toEqual([]);
  });

  it("won't let a player overwrite someone else's progress", async () => {
    const { error } = await b.db.from('progress').upsert({ user_id: a.id, meta: { ink: 99999 } });
    expect(error).not.toBeNull();
    const { data } = await a.db.from('progress').select('meta').eq('user_id', a.id).single();
    expect((data!.meta as { ink: number }).ink).toBe(5);
  });

  it("won't let a player mark their own run verified or write a leaderboard", async () => {
    const forged = {
      user_id: a.id,
      seed: 1,
      starter: 'apprentice',
      result: 'won',
      act: 3,
      score: 999999,
      words: 1,
      max_combo: 1,
      peak_wpm: 300,
      accuracy: 1,
      report: {},
      verified: true,
    };
    expect((await a.db.from('runs').insert(forged)).error).not.toBeNull();
    expect((await a.db.from('runs').insert({ ...forged, verified: false })).error).toBeNull();
    const lb = await a.db.from('leaderboard').insert({ board: 'all-time', user_id: a.id, score: 999999 });
    expect(lb.error).not.toBeNull();
  });

  it('rejects bad usernames', async () => {
    expect((await a.db.from('profiles').update({ username: 'no spaces!' }).eq('id', a.id)).error).not.toBeNull();
    expect((await a.db.from('profiles').update({ username: NAME }).eq('id', a.id)).error).toBeNull();
  });
});

describe('verify-run', () => {
  const cfg = newRunConfig('apprentice', 4242);
  const honest = playRun(cfg, { wpm: 70, accuracy: 0.97, rng: makeRng(2) });

  it('refuses callers who are not signed in', async () => {
    expect((await call('verify-run', null, { config: cfg, actions: honest.actions })).status).toBe(401);
  });

  it('accepts an honest run, stores it verified, and ranks it', async () => {
    const res = await call('verify-run', a.token, { config: cfg, actions: honest.actions });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.standings['all-time'].rank).toBeGreaterThanOrEqual(1);
    const { data } = await a.db.from('runs').select('verified, score').eq('id', body.runId).single();
    expect(data).toMatchObject({ verified: true, score: body.score });
    const board = await b.db
      .from('leaderboard_named')
      .select('username, score')
      .eq('board', 'all-time')
      .eq('user_id', a.id)
      .single();
    expect(board.data?.username).toBe(NAME);
  });

  it('rejects a forged run', async () => {
    let t = 0;
    const squashed: Action[] = honest.actions.map((x) =>
      x.t === 'key' || x.t === 'bs' || x.t === 'untarget' || x.t === 'time' ? { ...x, at: (t += 4) } : ((t = 0), x),
    );
    const res = await call('verify-run', b.token, { config: cfg, actions: squashed });
    expect(res.status).toBe(422);
    const tampered = honest.actions.map((x) => (x.t === 'key' ? { ...x, k: 'q' } : x));
    expect((await call('verify-run', b.token, { config: cfg, actions: tampered })).status).toBe(422);
  });
});

describe('verify-practice', () => {
  it('replays a 15-second test and ranks it', async () => {
    const config = { mode: 'time' as const, amount: 15, punctuation: false, numbers: false, seed: 11 };
    const s = createPractice(config);
    const inputs: { k: string; at: number }[] = [];
    for (let at = 0; at < 15_000; at += 160) {
      const k = s.text[s.pos];
      inputs.push({ k, at });
      pressPractice(s, k, at);
    }
    const res = await call('verify-practice', a.token, { config, inputs });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ranked).toBe(true);
    expect(body.result.wpm).toBeGreaterThan(60);
  });
});

describe('daily runs', () => {
  const today = new Date().toISOString().slice(0, 10);

  it('lets a player claim only today, and only once', async () => {
    const c = await newPlayer();
    expect((await c.db.from('daily_entries').insert({ user_id: c.id, day: '2020-01-01' })).error).not.toBeNull();
    expect((await c.db.from('daily_entries').insert({ user_id: c.id, day: today })).error).toBeNull();
    expect((await c.db.from('daily_entries').insert({ user_id: c.id, day: today })).error).not.toBeNull();
    expect((await c.db.from('daily_entries').delete().eq('user_id', c.id).select()).data).toEqual([]);
  });

  it('ranks a claimed daily once and refuses a second or unclaimed one', async () => {
    const c = await newPlayer();
    const cfg = sharedRunConfig('daily', 'apprentice');
    const played = playRun(cfg, { wpm: 70, accuracy: 0.97, rng: makeRng(3) });
    const body = { config: cfg, actions: played.actions };
    const unclaimed = await call('verify-run', c.token, body);
    expect(unclaimed.status).toBe(422);
    await c.db.from('daily_entries').insert({ user_id: c.id, day: today });
    const first = await (await call('verify-run', c.token, body)).json();
    expect(first.ok).toBe(true);
    expect(first.standings[`daily:${today}`].rank).toBeGreaterThanOrEqual(1);
    const again = await call('verify-run', c.token, body);
    expect(again.status).toBe(422);
  });

  it('refuses a daily with bonuses', async () => {
    const cfg = sharedRunConfig('daily', 'apprentice');
    const res = await call('verify-run', b.token, {
      config: { ...cfg, bonuses: { ...cfg.bonuses, maxHp: 30 } },
      actions: [],
    });
    expect((await res.json()).reason).toBe('shared runs start without bonuses');
  });
});

describe('ghosts and the Heat board', () => {
  it("lets anyone race a ranked practice test's keystrokes", async () => {
    const { data } = await b.db
      .from('leaderboard_named')
      .select('practice_id')
      .eq('board', 'practice:time-15')
      .eq('user_id', a.id)
      .single();
    expect(data?.practice_id).toBeTruthy();
    const ghost = await b.db.from('practice_results').select('replay').eq('id', data!.practice_id).single();
    expect((ghost.data?.replay as { inputs: unknown[] }).inputs.length).toBeGreaterThan(50);
    // Unranked results stay private.
    const others = await b.db.from('practice_results').select('id').eq('user_id', a.id);
    expect(others.data).toHaveLength(1);
  });

  it('puts a won run with Oaths on the Heat board', async () => {
    const cfg = newRunConfig('apprentice', 99, {}, { oaths: { fragile: 1 } });
    let won = null;
    for (let i = 0; i < 12 && !won; i++) {
      const r = playRun({ ...cfg, seed: 99 + i }, { wpm: 110, accuracy: 0.99, rng: makeRng(i) });
      if (r.run.result === 'won') won = { config: { ...cfg, seed: 99 + i }, actions: r.actions };
    }
    expect(won).not.toBeNull();
    const body = await (await call('verify-run', b.token, won)).json();
    expect(body.standings.heat).toMatchObject({ best: 1 });
  });
});

describe('delete-account', () => {
  it('deletes the account and all of its data', async () => {
    const c = await newPlayer();
    await c.db.from('progress').upsert({ user_id: c.id, meta: {} });
    expect((await call('delete-account', c.token, {})).status).toBe(200);
    const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data } = await admin.from('progress').select('user_id').eq('user_id', c.id);
    expect(data).toEqual([]);
  });
});
