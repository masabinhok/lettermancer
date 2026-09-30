# Keycraft

A roguelike typing game where your keyboard is the deck. Type words to fight illuminated glyph-monsters, win boons
from six muses, and bind powers to individual keys — so your **E** burns, your **S** freezes, and your **N** throws
sparks. Every run quietly feeds you more of the keys you're slowest at, so you get faster while you play.

## Running it

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command            | What it does                                                                     |
| ------------------ | -------------------------------------------------------------------------------- |
| `npm run dev`      | Start the web app                                                                |
| `npm run build`    | Build the static site to `apps/web/build`                                        |
| `npm test`         | Unit tests, replay determinism, and the balance bot                              |
| `npm run test:e2e` | Playwright end-to-end tests                                                      |
| `npm run check`    | Typecheck the app and the engine                                                 |
| `npm run lint`     | ESLint                                                                           |
| `npm run playtest` | A bot that plays the real game in a headless browser and screenshots each screen |

## How to play

New players start with a short **tutorial** that teaches everything below by doing it. You can replay it from the
title screen.

### A run

A run is **three acts**. In each act you pass through **seven rooms, then a boss**. After every room you choose your
next one from two or three **doors**, and each door shows what's behind it:

| Door          | What happens                                      |
| ------------- | ------------------------------------------------- |
| A muse's name | A fight. Win it and that muse offers you a boon.  |
| Purse         | A fight with a big coin reward.                   |
| Spring        | A fight, then heal 35% of your health.            |
| Elite         | A hard fight guarding a relic.                    |
| Shop          | Buy key powers, relics and healing.               |
| Unknown       | An event: a choice, sometimes a typing challenge. |

Your health carries between rooms. Beating a boss heals 40%.

### Fighting

- Every enemy carries a **word**. The first letter you type locks onto that word; finish it to strike.
- The bar under each enemy fills toward its next attack. The card **glows red one second before the hit**.
- **Backspace** deletes a letter. **Tab** lets go of your target. **Esc** pauses.
- Fights come in **waves**: the next wave arrives when the field is clear.
- Enemies have **traits**, shown on their card: _Armored_ (short words deal half), _Shifting_ (its word changes),
  _Splits_, _Thief_ (steals combo), _Healer_, _Enraged_, _Warden_ (shields allies), _Summoner_, _Quick_.

### Combo

Every correct key builds combo. A typo resets it. Half your combo carries into the next fight.

| Combo  | 0–9 | 10–24 | 25–49 | 50–99 | 100+ |
| ------ | --- | ----- | ----- | ----- | ---- |
| Damage | ×1  | ×1.5  | ×2    | ×3    | ×4   |

### Muses, powers and blessings

Six muses offer boons after the fights behind their doors:

| Muse       | Key power                             | Blessings                      |
| ---------- | ------------------------------------- | ------------------------------ |
| **Ignis**  | Ember: letters set the target burning | Kindling, Wildfire, Flashpoint |
| **Glacia** | Frost: letters push attacks back      | Cold Snap, Brittle, Permafrost |
| **Volta**  | Spark: letters zap other enemies      | Arc, Static, Overcharge        |
| **Aurum**  | Gold: letters earn coins              | Tithe, Midas, Windfall         |
| **Resona** | Echo: letters deal more damage        | Reverb, Chorus, Crescendo      |
| **Aegis**  | Ward: letters grant shield            | Bulwark, Riposte, Mending      |

- **Key powers** come in four rarities (Common, Rare, Epic, Heroic). You choose a power, then **press the key** that
  should carry it. A key holds two powers; binding the same power again makes it one rarity stronger.
- **Blessings** change the rules of your whole run.
- Hold boons from two muses and a **duo boon** may appear, such as Steam (Ignis + Glacia) or Thunderclap (Resona +
  Volta).
- **Glass** is found only in shops: huge damage, but mistyping its key shatters it.
- **Relics** come from elites, bosses and shops.

Press **B** between rooms (or open the pause menu) to see your whole build.

### Bosses

Each act has one of two bosses, each with phases that change the rules as it weakens:

- **Act I:** Hydra of Ands (grows heads) or the Mirror Scribe (backwards words)
- **Act II:** Blackout (words fade from view) or The Redactor (blots out letters you must work out)
- **Act III:** The Grammarian (punctuation, then two-word phrases) or the Lexicon Wyrm (enormous words)

### Oaths and Gentle pace

- **Oaths** make runs harder on purpose: faster enemies, tougher enemies, typos that cost health, a combo that breaks
  if you pause, capital letters, punctuation, pricier shops. Each level adds **Heat**, which multiplies your score.
- **Gentle pace** makes enemies slower and weaker while you're learning. Gentle runs don't count for leaderboards.

## Between runs: the Scriptorium

You return to the Scriptorium after every run. The **Archivist** remembers how your last run went and has advice.

- **Ink** comes from every run (more at higher Heat). Spend it in the **Codex of Hands** on small permanent
  upgrades: a little more health, starting coins, starting combo, rerolls. Prices rise with each rank, so your
  typing stays the main source of power.
- **Gold Leaf** comes from beating bosses and winning under Oaths. It buys the rarest upgrades: an extra boon choice,
  a guaranteed Rare first boon, and a Second Wind.
- **Keepsakes** are found by reaching milestones. Carry one into each run; it levels up the more you carry it.
- **Prophecies** are 60+ achievements for speed, accuracy, combos, bosses, builds, exploration and key mastery.
  They pay **Seals**, which the Archivist trades for Gold Leaf.
- The **Codex** fills in with every foe, boss and boon you meet.
- **Key mastery**: every letter earns Bronze, Silver and Gold as you get faster and cleaner at it.
- Your Oath limit rises as you win: you can carry two more Heat than the most you've won at.

## Practice desk

Press **R** in the Scriptorium to practice outside of runs:

- **Time** (15/30/60/120 s) and **Words** (10/25/50/100) tests, with optional punctuation and numbers.
- **Quotes** from public-domain literature.
- **Adaptive lessons** that start with six letters and unlock the next one only when you type the newest letter
  quickly and cleanly.
- **Trials**: tests with a bar to clear. They pay Gold Leaf, and most let you swear one more Heat of Oaths.

Results show speed, raw speed, accuracy, consistency, a per-second chart, and the letters you slowed down on.
Practice earns a little Ink (capped daily) and keeps a daily streak. **Tab** restarts, **Esc** leaves, and the
interface fades while you type.

## Learning while you play

- Every keystroke is timed. Keys that are slow or error-prone get a weakness score, and about 30% of enemy words are
  picked to drill them.
- After each run you see a **heatmap** of your keyboard and your hardest letter pair.
- **Finger colors** show which finger should press each key, for QWERTY, Dvorak, Colemak and AZERTY.

## Project layout

```
packages/engine/   the game rules: deterministic, framework-free, fully tested
  src/content/     enemies, bosses, events, oaths, word list
apps/web/          the SvelteKit app (screens, design system, effects, sound)
e2e/               Playwright tests
scripts/           the playtest bot
docs/              roadmap, design system, reviews
```

Runs are **deterministic**: a run is its seed plus the list of actions you took, so any run can be replayed exactly.
That's how save/resume works.
