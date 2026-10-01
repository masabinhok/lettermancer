# Adding content

Most of Lettermancer's content is data in `packages/engine/src`. Adding an enemy, boon, relic or prophecy usually means
adding one entry, and sometimes one rule where the engine applies it. The web app reads everything from the engine,
so new content shows up in the Codex, shops and build screen without UI changes.

Before you start:

- Run `npm test` before and after. The balance bot in `packages/engine/tests/sim.test.ts` fails if a change makes
  runs much easier or harder. If you changed balance on purpose, update its thresholds and explain why in the PR.
- If your change alters what an existing run does (numbers, rules, random draws), bump `RULES_VERSION` in
  `machine.ts`. Saved runs and submitted replays from the old rules are then discarded instead of replaying wrongly.

## An enemy

Enemies live in `content/enemies.ts`. Stats are multipliers on the act's baseline in `ACT_BASE`:

```ts
// in ROSTER[1], the Act II pool
m('Caret Cutpurse', '^', ['thief', 'quick'], 0.9, 0.8, 0.7),
//  name             glyph traits            hp   atk  speed (below 1 attacks faster)
```

- `ROSTER[act]` holds ordinary foes, `ELITES` holds elites, and bosses are in `BOSSES` in the same file.
- Traits come from the `Trait` type in `state.ts`. A new trait needs its behaviour in `combat.ts` (search for an
  existing trait such as `'healer'`) and a line in `TRAIT_EVERY` if it acts on a timer.
- Pick a glyph that renders in Cormorant Garamond or Cinzel. Check it on the Codex screen.

## A key power, blessing or duo boon

These live in `mods.ts`:

- **Key powers** (`MODS`) belong to a muse and scale by rarity through `describe(rarity)`. Their effect on a keystroke
  is applied in `combat.ts`.
- **Blessings** (`BLESSINGS`) take one muse. A **duo boon** takes two, and it's offered automatically once a player
  holds boons from both muses (`eligibleDuos`).

Add the id to the union type (`ModId` or `BlessingId`), add the entry, and implement the effect where the engine
handles similar ones. Search for an existing id such as `'mending'` to find the spot. Add a test in
`packages/engine/tests/combat.test.ts` that shows the effect.

## A relic

Relics are in `RELICS` in `mods.ts`, with a `cost` for shops. Add the id to `RelicId`, add the definition, then apply
it in `combat.ts` or `machine.ts` next to a similar relic (search for `'thorns'` or `'first-strike'`).

## An event

Events are in `content/events.ts` (`EVENTS`, plus the `EventId` type). The choices and outcomes are built in
`machine.ts`. Search for an existing event id such as `'inkwell'` and follow its pattern. Keep event text short:
one scene-setting sentence, then choices that say exactly what they cost and give.

## A prophecy (achievement)

Prophecies are in `content/prophecies.ts`. Each is one call to `p(...)`:

```ts
p('clean-hands', 'Accuracy', 'Clean Hands', 'Win a run at 99% accuracy or better.', 3, (x) => won(x) && acc(x) >= 0.99),
```

`check` gets a `ProphecyCtx` with the player's meta, key mastery, and either the finished run or the practice test.
Use the helpers at the top of the file (`won`, `acc`, `picked`, `ranked`). Keep the Seal reward in line with
similar prophecies. Prophecies are checked after every run and test, so `check` must be cheap.

## A practice quote or trial

- Quotes are in `content/quotes.ts`. They must be in the **public domain**; put the author and work in `source`.
- Trials are in `content/trials.ts`: a test mode, a length, and the speed and accuracy to beat.

## Words

The word pool is `content/words.json`, filtered from SCOWL (see [CREDITS.md](CREDITS.md)). Don't add words by hand.
Change the filter instead and regenerate the file, so the list stays reproducible and correctly licensed.

## Checklist for a content PR

- [ ] `npm test`, `npm run check` and `npm run lint` pass
- [ ] The new thing appears correctly in the Codex or build screen (a screenshot in the PR helps)
- [ ] `RULES_VERSION` bumped if existing runs would now play out differently
- [ ] README tables updated if you added a muse, boss or door type
