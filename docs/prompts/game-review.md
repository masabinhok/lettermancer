# Game review prompt

Paste this into Claude Code (with the Chrome extension connected) at the end of every phase. A phase is done only when the review finds no Blocker or Major issues.

---

You are a senior game designer and web game developer who has shipped action roguelikes
(think Hades / Hades II, Slay the Spire, Balatro) and knows typing products deeply
(Monkeytype, Keybr, TypeRacer, Nitro Type, ZType, Epistory, The Typing of the Dead).

Review the web game "Lettermancer" in this repository. It is a roguelike typing game: enemies carry
words, typing a word strikes that enemy, and players install "mods" onto physical keys.

## How to review

1. Read README.md, then skim src/engine (the rules) and src/ui (the screens) so you know what
   exists. Do not review code style. Review the player experience.
2. Run the game (`npm install && npm run dev`) and play it in the browser. Do at least:
   - one run as a total newcomer: don't read the README first, and note every moment of confusion
   - one run playing deliberately well
   - one run typing slowly (~25 wpm) with frequent typos
     Take screenshots of every screen and of any moment worth commenting on.
3. Run the balance bot (`npm test`, tests/sim.test.ts) and interpret the results.

## Judge it on

- First 60 seconds: does a new player know what to do, why, and how to win? (onboarding)
- Clarity during combat: can you read the word, target, threat and your own state at a glance
  while your eyes are on the text? What competes for attention?
- Game feel: feedback on every keystroke, hit, kill, combo, damage taken. Sound, motion,
  hit-stop, screen shake. Is anything missing or overdone?
- Difficulty curve and fairness: where do players die, and does it feel earned?
- Decision depth: are reward/shop/mod choices interesting, or obvious/random?
  Do builds emerge? Is there build identity like Hades boons?
- Progression and motivation: why would someone start a 10th run? What carries over?
- Learning value: does the player measurably get better at typing, and do they feel it?
- Visual design: hierarchy, typography, color, spacing, consistency, "premium" feel.
- Usability & accessibility: keyboard-only navigation, discoverability of controls,
  colorblind safety, reduced motion, non-QWERTY layouts, screen sizes.
- Technical: frame rate, input latency, load time, save/resume, errors in the console.

## Compare against

For each area, name what a specific reference game does better and what we could borrow
(for example: Hades' door reward previews and hub, Balatro's scoring readability,
Monkeytype's minimal focus mode and results graph, Keybr's adaptive lessons).

## Output

1. A 5-line verdict: what the game is today and the single biggest thing holding it back.
2. Findings, ranked by severity (Blocker / Major / Minor / Polish). Each one has:
   what happened, the evidence (screenshot or steps), why it matters to the player,
   and a concrete fix.
3. Quick wins (< 1 day each) versus deep changes (need design work).
4. Suggested improvements to mechanics and progression, each with the reason behind it.
5. What is already good and must be protected in any redesign.
   Be blunt and specific. No generic advice like "improve the UI". Say what, where and how.
