import { describe, expect, it } from 'vitest';
import { backspace, createCombat, pressKey, tick, type Combat } from '../src/combat';
import { comboTier, installMod, resolveWord } from '../src/mods';
import type { Run } from '../src/state';
import { queueCtx, spec, testRun } from './helpers';

const typeWord = (c: Combat, run: Run, ctx: ReturnType<typeof queueCtx>, w: string) =>
  [...w].flatMap((k, i) => pressKey(c, run, k, ctx, i * 100));

describe('resolveWord', () => {
  it('counts one damage per letter with no mods', () => {
    expect(resolveWord('cat', {}, [], 0, false).dmg).toBe(3);
  });

  it('applies echo (+1) then glass (x3) per letter', () => {
    const mods = { a: ['echo', 'glass'] as const };
    // c=1, a=(1+1)*3=6, t=1
    expect(resolveWord('cat', { a: [...mods.a] }, [], 0, false).dmg).toBe(8);
  });

  it('scales with combo tier', () => {
    expect(comboTier(9).mult).toBe(1);
    expect(comboTier(10).mult).toBe(1.5);
    expect(comboTier(100).mult).toBe(4);
    expect(resolveWord('four', {}, [], 25, false).dmg).toBe(8);
  });

  it('collects effect counts from mods', () => {
    const r = resolveWord('eerie', { e: ['ember', 'gold'], r: ['frost'], i: ['ward'] }, [], 0, false);
    expect(r.burn).toBe(6);
    expect(r.coins).toBe(3);
    expect(r.frost).toBe(1);
    expect(r.shield).toBe(1);
  });

  it('applies relics', () => {
    expect(resolveWord('ball', {}, ['twin-fangs'], 0, false)).toMatchObject({ dmg: 8, crit: true });
    expect(resolveWord('bald', {}, ['twin-fangs'], 0, false).crit).toBe(false);
    expect(resolveWord('cat', {}, ['no-e'], 0, false).dmg).toBe(5); // round(4.5)
    expect(resolveWord('cat', {}, ['first-strike'], 0, true).dmg).toBe(9);
    expect(resolveWord('cat', {}, ['whetstone'], 0, false).dmg).toBe(5);
    expect(resolveWord('keyboard', {}, ['marathon'], 0, false).heal).toBe(2);
  });
});

describe('installMod', () => {
  it('holds two mods per key and pushes out the oldest', () => {
    let km = installMod({}, 'e', 'ember').keyMods;
    km = installMod(km, 'e', 'gold').keyMods;
    const r = installMod(km, 'e', 'frost');
    expect(r.replaced).toBe('ember');
    expect(r.keyMods.e).toEqual(['gold', 'frost']);
  });
});

describe('combat', () => {
  it('targets by first letter and damages on completion', () => {
    const run = testRun();
    const ctx = queueCtx(['cat', 'dog', 'cow']);
    const c = createCombat([spec(), spec()], ctx);
    const ev = typeWord(c, run, ctx, 'dog');
    expect(ev[0]).toMatchObject({ t: 'target', enemyId: 2 });
    expect(c.enemies[1].hp).toBe(97);
    expect(c.enemies[1].word).toBe('cow');
    expect(c.typed).toBe('');
    expect(c.targetId).toBeNull();
  });

  it('builds combo on correct keys and resets on a typo', () => {
    const run = testRun();
    const ctx = queueCtx(['abcdef']);
    const c = createCombat([spec()], ctx);
    typeWord(c, run, ctx, 'abc');
    expect(c.combo).toBe(3);
    const ev = pressKey(c, run, 'x', ctx, 0);
    expect(ev).toContainEqual({ t: 'key-miss', key: 'x', expected: 'd' });
    expect(c.combo).toBe(0);
    expect(c.typed).toBe('abc'); // progress kept, the wrong key is just rejected
    expect(c.stats.keys.d.err).toBe(1);
  });

  it('steady hands halves combo instead of resetting', () => {
    const run = testRun();
    run.relics = ['steady-hands'];
    const ctx = queueCtx(['abcdef']);
    const c = createCombat([spec()], ctx);
    typeWord(c, run, ctx, 'abcd');
    pressKey(c, run, 'x', ctx, 0);
    expect(c.combo).toBe(2);
  });

  it('shatters glass when its key is mistyped', () => {
    const run = testRun();
    run.keyMods = { b: ['glass'] };
    const ctx = queueCtx(['abc']);
    const c = createCombat([spec()], ctx);
    pressKey(c, run, 'a', ctx, 0);
    const ev = pressKey(c, run, 'q', ctx, 0);
    expect(ev).toContainEqual({ t: 'glass-shatter', key: 'b' });
    expect(run.keyMods.b).toBeUndefined();
  });

  it('enemies attack when intent fills, shield absorbs first', () => {
    const run = testRun();
    const ctx = queueCtx(['abc']);
    const c = createCombat([spec({ atk: 5, intentMs: 1000 })], ctx);
    c.shield = 3;
    const hp = run.hp;
    const ev = tick(c, run, 1000);
    expect(ev).toContainEqual({ t: 'player-hit', enemyId: 1, dmg: 2, blocked: 3 });
    expect(run.hp).toBe(hp - 2);
  });

  it('burn ticks each second and decays', () => {
    const run = testRun();
    run.keyMods = { a: ['ember'] };
    const ctx = queueCtx(['aaa', 'zzz']);
    const c = createCombat([spec({ intentMs: 1e9 })], ctx);
    typeWord(c, run, ctx, 'aaa');
    const e = c.enemies[0];
    expect(e.burn).toBe(6);
    tick(c, run, 1000);
    expect(e.hp).toBe(100 - 3 - 6);
    expect(e.burn).toBe(5);
  });

  it('frost pushes the attack back', () => {
    const run = testRun();
    run.keyMods = { a: ['frost'] };
    const ctx = queueCtx(['aa', 'zzz']);
    const c = createCombat([spec({ intentMs: 1e9 })], ctx);
    c.enemies[0].intent = 3000;
    typeWord(c, run, ctx, 'aa');
    expect(c.enemies[0].intent).toBe(1600);
  });

  it('wins when the last enemy dies', () => {
    const run = testRun();
    const ctx = queueCtx(['abc']);
    const c = createCombat([spec({ hp: 3, maxHp: 3 })], ctx);
    const ev = typeWord(c, run, ctx, 'abc');
    expect(ev).toContainEqual({ t: 'kill', enemyId: 1 });
    expect(ev).toContainEqual({ t: 'win' });
    expect(c.over).toBe('win');
  });

  it('loses when hp hits zero', () => {
    const run = testRun();
    run.hp = 3;
    const ctx = queueCtx(['abc']);
    const c = createCombat([spec({ atk: 10, intentMs: 100 })], ctx);
    const ev = tick(c, run, 100);
    expect(ev).toContainEqual({ t: 'lose' });
    expect(run.hp).toBe(0);
  });

  it('mirror boss words are reversed', () => {
    const ctx = queueCtx(['stop']);
    const c = createCombat([spec({ rule: 'mirror', kind: 'boss' })], ctx);
    expect(c.enemies[0].word).toBe('pots');
  });

  it('hydra grows heads when hit', () => {
    const run = testRun();
    const ctx = queueCtx(['abc', 'xyz', 'def']);
    const c = createCombat([spec({ rule: 'hydra', kind: 'boss' })], ctx);
    const ev = typeWord(c, run, ctx, 'abc');
    expect(ev.some((e) => e.t === 'spawn')).toBe(true);
    expect(c.enemies).toHaveLength(2);
  });

  it('records bigram latency between consecutive correct keys', () => {
    const run = testRun();
    const ctx = queueCtx(['abc']);
    const c = createCombat([spec()], ctx);
    pressKey(c, run, 'a', ctx, 0);
    pressKey(c, run, 'b', ctx, 250);
    expect(c.stats.bigrams.ab).toEqual({ lat: 250, n: 1 });
  });

  it('backspace deletes one letter, then drops the target', () => {
    const run = testRun();
    const ctx = queueCtx(['abcd']);
    const c = createCombat([spec()], ctx);
    typeWord(c, run, ctx, 'ab');
    backspace(c);
    expect(c.typed).toBe('a');
    expect(c.targetId).toBe(1);
    backspace(c);
    backspace(c);
    expect(c.targetId).toBeNull();
    expect(c.combo).toBe(2); // deleting isn't a typo
  });
});
