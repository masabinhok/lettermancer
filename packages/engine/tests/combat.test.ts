import { describe, expect, it } from 'vitest';
import { backspace, createCombat, pressKey, sandLimitMs, tick, type Combat, type CombatCtx } from '../src/combat';
import { comboTier, eligibleDuos, installMod, resolveWord, type WordContext } from '../src/mods';
import type { EnemySpec, Run } from '../src/state';
import { queueCtx, spec, testRun } from './helpers';

const typeWord = (c: Combat, run: Run, ctx: CombatCtx, w: string, t0 = 0) =>
  [...w].flatMap((k, i) => pressKey(c, run, k, ctx, t0 + i * 100));

const fight = (run: Run, ctx: CombatCtx, ...specs: EnemySpec[]) => createCombat([specs], ctx, run);

const wctx = (over: Partial<WordContext> = {}): WordContext => ({
  keyMods: {},
  relics: [],
  blessings: [],
  combo: 0,
  firstWord: false,
  coins: 0,
  streak: 0,
  ...over,
});

/** Run the clock forward in small steps, like the game does. */
const run5 = (c: Combat, run: Run, ctx: CombatCtx, ms: number) => {
  const ev = [];
  for (let t = 0; t < ms; t += 5) ev.push(...tick(c, run, 5, ctx));
  return ev;
};

describe('resolveWord', () => {
  it('counts one damage per letter with no powers', () => {
    expect(resolveWord('cat', wctx()).dmg).toBe(3);
  });

  it('applies echo (+potency) then glass (×) per letter, by rarity', () => {
    // c=1, a=(1+1)*3=6, t=1
    const km = {
      a: [
        { mod: 'echo' as const, rarity: 0 as const },
        { mod: 'glass' as const, rarity: 0 as const },
      ],
    };
    expect(resolveWord('cat', wctx({ keyMods: km })).dmg).toBe(8);
    const heroicGlass = { a: [{ mod: 'glass' as const, rarity: 3 as const }] };
    expect(resolveWord('cat', wctx({ keyMods: heroicGlass })).dmg).toBe(1 + 6 + 1);
  });

  it('scales with combo tier, and Chorus adds to it', () => {
    expect(comboTier(9).mult).toBe(1);
    expect(comboTier(10).mult).toBe(1.5);
    expect(comboTier(25, ['chorus']).mult).toBe(3);
    expect(resolveWord('four', wctx({ combo: 25 })).dmg).toBe(8);
  });

  it('collects effects from powers, scaled by rarity', () => {
    const r = resolveWord(
      'eerie',
      wctx({
        keyMods: {
          e: [
            { mod: 'ember', rarity: 0 },
            { mod: 'gold', rarity: 0 },
          ],
          r: [{ mod: 'frost', rarity: 1 }],
          i: [{ mod: 'ward', rarity: 3 }],
        },
      }),
    );
    expect(r.burn).toBe(6);
    expect(r.coins).toBe(3);
    expect(r.frostMs).toBe(1050);
    expect(r.shield).toBe(3);
  });

  it('applies relics and blessings', () => {
    expect(resolveWord('ball', wctx({ relics: ['twin-fangs'] }))).toMatchObject({ dmg: 8, crit: true });
    expect(resolveWord('cat', wctx({ relics: ['no-e'] })).dmg).toBe(5);
    expect(resolveWord('cat', wctx({ relics: ['first-strike'], firstWord: true })).dmg).toBe(9);
    expect(resolveWord('cat', wctx({ blessings: ['midas'], coins: 46 })).dmg).toBe(6);
    expect(resolveWord('cat', wctx({ blessings: ['crescendo'], streak: 20 })).dmg).toBe(11);
    // Reverb doubles each letter of a doubled pair: b + a + l*2 + l*2 = 6
    expect(resolveWord('ball', wctx({ blessings: ['reverb'] })).dmg).toBe(6);
  });
});

describe('installMod', () => {
  it('upgrades the same power instead of stacking it', () => {
    let km = installMod({}, 'e', 'ember').keyMods;
    const r = installMod(km, 'e', 'ember');
    expect(r.upgraded).toBe(true);
    expect(r.keyMods.e).toEqual([{ mod: 'ember', rarity: 1 }]);
    km = installMod(r.keyMods, 'e', 'gold').keyMods;
    const pushed = installMod(km, 'e', 'frost');
    expect(pushed.replaced).toBe('ember');
  });

  it('qualifies duos when holding boons from both muses', () => {
    const km = { e: [{ mod: 'ember' as const, rarity: 0 as const }] };
    expect(eligibleDuos(km, ['cold-snap'])).toContain('steam');
    expect(eligibleDuos(km, [])).toEqual([]);
  });
});

describe('combat basics', () => {
  it('targets by first letter and damages on completion', () => {
    const run = testRun();
    // 'cow' would clash with 'cat' on the first letter, so the enemy skips it.
    const ctx = queueCtx(['cat', 'dog', 'cow', 'emu']);
    const c = fight(run, ctx, spec(), spec());
    const ev = typeWord(c, run, ctx, 'dog');
    expect(ev[0]).toMatchObject({ t: 'target', enemyId: 2 });
    expect(c.enemies[1].hp).toBe(97);
    expect(c.enemies[1].word).toBe('emu');
  });

  it('builds combo on correct keys and resets on a typo', () => {
    const run = testRun();
    const ctx = queueCtx(['abcdef']);
    const c = fight(run, ctx, spec());
    typeWord(c, run, ctx, 'abc');
    const ev = pressKey(c, run, 'x', ctx, 500);
    expect(ev).toContainEqual({ t: 'key-miss', key: 'x', expected: 'd' });
    expect(c.combo).toBe(0);
    expect(c.typed).toBe('abc');
  });

  it('backspace deletes a letter, then drops the target', () => {
    const run = testRun();
    const ctx = queueCtx(['abcd']);
    const c = fight(run, ctx, spec());
    typeWord(c, run, ctx, 'ab');
    backspace(c);
    expect(c.typed).toBe('a');
    backspace(c);
    backspace(c);
    expect(c.targetId).toBeNull();
  });

  it('shatters glass when its key is mistyped', () => {
    const run = testRun();
    run.keyMods = { b: [{ mod: 'glass', rarity: 0 }] };
    const ctx = queueCtx(['abc']);
    const c = fight(run, ctx, spec());
    pressKey(c, run, 'a', ctx, 0);
    expect(pressKey(c, run, 'q', ctx, 50)).toContainEqual({ t: 'glass-shatter', key: 'b' });
    expect(run.keyMods.b).toBeUndefined();
  });

  it('enemies attack when their timer fills; shield absorbs first', () => {
    const run = testRun();
    const ctx = queueCtx(['abc']);
    const c = fight(run, ctx, spec({ atk: 5, intentMs: 1000 }));
    c.shield = 3;
    const hp = run.hp;
    const ev = run5(c, run, ctx, 1000);
    expect(ev).toContainEqual({ t: 'player-hit', enemyId: 1, dmg: 2, blocked: 3 });
    expect(run.hp).toBe(hp - 2);
  });

  it('burn ticks each second and decays; Kindling doubles the rate', () => {
    for (const [blessings, expected] of [
      [[], 100 - 3 - 6],
      [['kindling'], 100 - 3 - 6 - 5],
    ] as const) {
      const run = testRun();
      run.blessings = [...blessings];
      run.keyMods = { a: [{ mod: 'ember', rarity: 0 }] };
      const ctx = queueCtx(['aaa', 'zzz']);
      const c = fight(run, ctx, spec({ intentMs: 1e9 }));
      typeWord(c, run, ctx, 'aaa');
      run5(c, run, ctx, 1000);
      expect(c.enemies[0].hp).toBe(expected);
    }
  });

  it('spawns the next wave when the field is clear', () => {
    const run = testRun();
    const ctx = queueCtx(['abc', 'xyz']);
    const c = createCombat([[spec({ hp: 3, maxHp: 3 })], [spec({ name: 'Second' })]], ctx, run);
    const ev = typeWord(c, run, ctx, 'abc');
    expect(ev).toContainEqual({ t: 'wave', wave: 2 });
    expect(c.over).toBeNull();
    expect(c.enemies[0].name).toBe('Second');
  });

  it('carries combo and Bulwark shield into a fight, and Golden Aegis adds shield', () => {
    const run = testRun();
    run.carryCombo = 12;
    run.carryShield = 4;
    run.coins = 50;
    run.blessings = ['golden-aegis'];
    const c = createCombat([[spec()]], queueCtx(['abc']), run);
    expect(c.combo).toBe(12);
    expect(c.shield).toBe(9);
  });

  it('second wind saves you once', () => {
    const run = testRun();
    run.hp = 3;
    run.bonuses = { ...run.bonuses, secondWind: 0.3 };
    run.secondWindLeft = true;
    const ctx = queueCtx(['abc']);
    const c = fight(run, ctx, spec({ atk: 10, intentMs: 100 }));
    const ev = run5(c, run, ctx, 100);
    expect(ev).toContainEqual({ t: 'second-wind', hp: 15 });
    expect(c.over).toBeNull();
    run5(c, run, ctx, 200);
    expect(c.over).toBe('lose');
  });
});

describe('enemy traits', () => {
  it('armored enemies take half damage from short words', () => {
    const run = testRun();
    const ctx = queueCtx(['cat', 'lantern', 'zzz']);
    const c = fight(run, ctx, spec({ traits: ['armored'] }));
    typeWord(c, run, ctx, 'cat');
    expect(c.enemies[0].hp).toBe(98);
    typeWord(c, run, ctx, 'lantern', 1000); // 7 letters at combo 10: ×1.5, not halved
    expect(c.enemies[0].hp).toBe(98 - 11);
  });

  it('shifters change their word after five seconds', () => {
    const run = testRun();
    const ctx = queueCtx(['abc', 'xyz']);
    const c = fight(run, ctx, spec({ traits: ['shifter'], intentMs: 1e9 }));
    const ev = run5(c, run, ctx, 5005);
    expect(ev).toContainEqual({ t: 'word-shift', enemyId: 1 });
    expect(c.enemies[0].word).toBe('xyz');
  });

  it('splitters burst into two minions', () => {
    const run = testRun();
    const ctx = queueCtx(['abc', 'dog', 'emu']);
    const c = fight(run, ctx, spec({ hp: 3, maxHp: 3, traits: ['splitter'] }));
    typeWord(c, run, ctx, 'abc');
    expect(c.enemies.map((e) => e.kind)).toEqual(['minion', 'minion']);
  });

  it('wardens shield allies, and shields absorb damage', () => {
    const run = testRun();
    const ctx = queueCtx(['abc', 'dog']);
    const c = fight(run, ctx, spec({ traits: ['warden'], intentMs: 1e9 }));
    run5(c, run, ctx, 7005);
    expect(c.enemies[0].shield).toBe(25);
    typeWord(c, run, ctx, 'abc', 8000);
    expect(c.enemies[0].shield).toBe(22);
    expect(c.enemies[0].hp).toBe(100);
  });

  it('thieves drain combo when they hit', () => {
    const run = testRun();
    const ctx = queueCtx(['abcdefghijkl']);
    const c = fight(run, ctx, spec({ traits: ['thief'], intentMs: 2000 }));
    typeWord(c, run, ctx, 'abcdefghijk');
    expect(c.combo).toBe(11);
    run5(c, run, ctx, 2000);
    expect(c.combo).toBe(1);
  });
});

describe('bosses', () => {
  it('the Mirror Scribe writes backwards and speeds up at half health', () => {
    const run = testRun();
    const ctx = queueCtx(['stop', 'ab', 'cdef', 'ghij']);
    const c = fight(run, ctx, spec({ kind: 'boss', rule: 'mirror', hp: 8, maxHp: 8, intentMs: 5000 }));
    expect(c.enemies[0].word).toBe('pots');
    const ev = typeWord(c, run, ctx, 'pots');
    expect(ev).toContainEqual({ t: 'phase', enemyId: 1, phase: 2 });
    expect(c.enemies[0].intentMs).toBe(4000);
  });

  it('the Redactor hides a letter but never the first', () => {
    const run = testRun();
    const c = fight(run, queueCtx(['candle']), spec({ kind: 'boss', rule: 'redactor' }));
    const e = c.enemies[0];
    expect(e.masked).toHaveLength(1);
    expect(e.masked[0]).toBeGreaterThan(0);
  });

  it('the Grammarian adds punctuation, then phrases', () => {
    const run = testRun();
    const ctx = queueCtx(['abcdefghij', 'lantern', 'quiet', 'mind', 'zzz']);
    const c = fight(run, ctx, spec({ kind: 'boss', rule: 'grammarian', hp: 30, maxHp: 30 }));
    typeWord(c, run, ctx, 'abcdefghij'); // 30 -> 20: phase 2
    expect(c.enemies[0].word).toMatch(/^lantern[,.;:!?]$/);
    typeWord(c, run, ctx, c.enemies[0].word, 2000); // 20 -> 12: phase 3
    expect(c.enemies[0].word).toMatch(/^\w+ \w+[,.;:!?]$/);
  });
});

describe('oaths', () => {
  it('Oath of Capitals makes case matter', () => {
    const run = testRun();
    run.oaths = { caps: 1 };
    const c = fight(run, queueCtx(['Abc']), spec({ traits: [] }));
    c.enemies[0].word = 'Abc';
    expect(pressKey(c, run, 'a', queueCtx([]), 0)).toContainEqual({ t: 'key-miss', key: 'a', expected: null });
    expect(pressKey(c, run, 'A', queueCtx([]), 10)[0]).toMatchObject({ t: 'target' });
  });

  it('Oath of Care costs health on every typo', () => {
    const run = testRun();
    run.oaths = { fragile: 1 };
    const ctx = queueCtx(['abc']);
    const c = fight(run, ctx, spec());
    const hp = run.hp;
    pressKey(c, run, 'q', ctx, 0);
    expect(run.hp).toBe(hp - 1);
  });

  it('Oath of Flow breaks combo after 2.5s without typing', () => {
    const run = testRun();
    run.oaths = { brittle: 1 };
    const ctx = queueCtx(['abcdefgh']);
    const c = fight(run, ctx, spec({ intentMs: 1e9 }));
    typeWord(c, run, ctx, 'abcdef');
    run5(c, run, ctx, 3200);
    expect(c.combo).toBe(0);
  });

  it('Oath of Haste speeds up attacks', () => {
    const run = testRun();
    run.oaths = { swift: 3 };
    const ctx = queueCtx(['abc']);
    const c = fight(run, ctx, spec({ intentMs: 1300 }));
    const ev = run5(c, run, ctx, 1000);
    expect(ev.some((e) => e.t === 'player-hit')).toBe(true);
  });
});

describe('boss signature relics', () => {
  it("Hydra's Tooth heals 2 on every kill", () => {
    const run = testRun();
    run.relics = ['hydra-tooth'];
    run.hp = 30;
    const ctx = queueCtx(['abc']);
    const c = fight(run, ctx, spec({ hp: 3, maxHp: 3 }));
    const ev = typeWord(c, run, ctx, 'abc');
    expect(ev).toContainEqual({ t: 'heal', amount: 2 });
    expect(run.hp).toBe(32);
  });

  it('Mirror Shard starts every fight with 6 Shield', () => {
    const run = testRun();
    run.relics = ['mirror-shard'];
    const c = fight(run, queueCtx(['abc']), spec());
    expect(c.shield).toBe(6);
  });

  it('Red Pen forgives only the first typo of a fight', () => {
    const run = testRun();
    run.relics = ['red-pen'];
    const ctx = queueCtx(['abcdef']);
    const c = fight(run, ctx, spec());
    typeWord(c, run, ctx, 'abc');
    pressKey(c, run, 'x', ctx, 500);
    expect(c.combo).toBe(3);
    pressKey(c, run, 'x', ctx, 600);
    expect(c.combo).toBe(0);
  });
});

describe('Oath of the Sandglass', () => {
  const calm = (over: Partial<EnemySpec> = {}) => spec({ intentMs: 1e9, ...over }); // never attacks

  it('does nothing until the sand runs out, then costs 1 health a second', () => {
    const run = testRun();
    run.oaths = { sand: 1 };
    const ctx = queueCtx(['abc']);
    const c = fight(run, ctx, calm());
    const hp = run.hp;
    expect(sandLimitMs(c, run)).toBe(60_000);
    tick(c, run, 60_000, ctx);
    expect(run.hp).toBe(hp);
    const ev = tick(c, run, 2_500, ctx);
    expect(ev.filter((e) => e.t === 'sand')).toHaveLength(2);
    expect(run.hp).toBe(hp - 2);
  });

  it('gives 45 seconds at level 2, and boss fights twice as long', () => {
    const run = testRun();
    run.oaths = { sand: 2 };
    const ctx = queueCtx(['abc']);
    expect(sandLimitMs(fight(run, ctx, calm()), run)).toBe(45_000);
    expect(sandLimitMs(fight(run, ctx, calm({ kind: 'boss' })), run)).toBe(90_000);
    run.oaths = {};
    expect(sandLimitMs(fight(run, ctx, calm()), run)).toBeNull();
  });

  it('can end the run when the sand outlasts your health', () => {
    const run = testRun();
    run.oaths = { sand: 1 };
    run.hp = 2;
    const ctx = queueCtx(['abc']);
    const c = fight(run, ctx, calm());
    tick(c, run, 63_000, ctx);
    expect(c.over).toBe('lose');
    expect(run.hp).toBe(0);
  });
});
