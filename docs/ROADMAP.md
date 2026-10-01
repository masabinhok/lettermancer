# Lettermancer roadmap

## Context

Lettermancer v0.1 (github.com/masabinhok/lettermancer, private) works and is fun, but it plays like a prototype:

- Players don't get enough guidance, and the screens are cluttered.
- The fonts don't hang together, and there is almost nothing that carries over between runs.
- Difficulty is fixed, and there is no login or database.

The goal is a polished, premium web game in the spirit of Hades II: a mythic ink-and-gold style, a hub you return to between runs, progress you earn by improving, and permanent unlocks. It should also have a Monkeytype-grade practice mode. The user will polish it privately, phase by phase. The final phase is open-sourcing it.

**Decisions so far:**

- **Backend:** Supabase.
- **Look:** original "mythic ink & gold". No Supergiant assets or characters.
- **Frontend:** SvelteKit for screens, the existing pure-TS engine, and canvas for effects.
- **Timeline:** no hard deadline. Quality first, open source last.

---

## 1. Review prompt

The quality gate for every phase lives in [prompts/game-review.md](prompts/game-review.md).

---

## 2. Current review: what feels off in v0.1 (from the code and design)

**Onboarding / understandability**

- The menu is a wall of text with four rules. There's no tutorial fight. The targeting model ("first letter picks the enemy") is never taught.
- Backspace drops your target. Every typing site uses Backspace to delete a character, so this clashes with players' habits.
- Mods are installed blind. You don't see how often a letter comes up, or what your current mods are doing.
- Relic tooltips only appear on hover, and you can't hover while you're typing.

**Clarity in combat**

- The word competes with the mod colors, the next-letter underline and the dimmed typed letters. Already-typed letters become hard to read.
- Enemy threat is a thin bar with a tiny "⚔ 5". There's no wind-up warning before a hit.
- The on-screen keyboard takes about a third of the screen during combat, and most players don't need it.

**Visuals**

- Four fonts that don't match (Bungee, DM Serif, JetBrains Mono, Space Grotesk). Bungee reads "arcade", not "mythic".
- The HUD crams HP, coins, map dots and relics into one row. The shop squeezes 7 cards side by side.

**Depth**

- Rewards are always 3 random mods, with no rarity, no way to steer a build and no combo rewards like Hades duo boons.
- The path through each act is fixed, with no choices, and bosses have one gimmick each.

**Progression**

- Only 3 unlocks. There's nothing to spend between runs, and dying teaches nothing.

**Difficulty**

- One fixed level. The balance bot shows a 30 wpm typist stalling in Act 2, while a 70 wpm typist wins about 95% of runs. There's no opt-in challenge like Hades' Heat.

**Missing**

- Settings, pause menu, closing the tab and resuming a run, non-QWERTY layouts, colorblind and reduced-motion modes, timed practice, accounts.

**Keep:** the core loop of typing to strike and installing a mod by pressing the key. Also keep the adaptive weak-key word picking, the tested pure engine and the balance bot.

---

## 3. What we borrow, and from where

| Source                     | Borrow                                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hades / Hades II           | Hub between runs with NPCs and story that moves on every death; god boons with rarities and duo boons; door choices that preview their reward; Mirror/Arcana permanent upgrades; the Pact of Punishment / Fear difficulty system; keepsakes; weapon aspects |
| Balatro                    | Very readable scoring (base × mult shown as it happens); jokers that combine; a satisfying count-up on every word                                                                                                                                           |
| Slay the Spire             | Branching act map; enemies show what they'll do next; ascension levels                                                                                                                                                                                      |
| Monkeytype                 | Clean focus mode; timed/word/quote tests; wpm/raw/accuracy/consistency graph; themes; strong settings culture                                                                                                                                               |
| Keybr                      | Letters unlock as you master them; per-key mastery goals                                                                                                                                                                                                    |
| ZType / Typing of the Dead | Typing that feels like an action game; lock-on targeting feedback                                                                                                                                                                                           |

**Design pillars:** (1) your fingers are the weapon, and skill is the only real power; (2) every run teaches you something; (3) always one more run; (4) readable while you type, even at 120 wpm.

---

## 4. Target architecture (arrives across the phases)

```
apps/web/            SvelteKit: routes for hub, run, practice, profile, leaderboards, settings
packages/engine/     current src/engine moved here: pure, deterministic, tested (rules, sim bot, replay verifier)
packages/content/    data: muses/boons, enemies, bosses, achievements, word lists, quotes
supabase/            migrations, RLS policies, edge functions (verify-run, daily-seed)
```

- **Rendering:**
  - Text stays in the DOM, for crisp words and accessibility.
  - A canvas layer draws effects: particles, trails, hit-stop flashes. It can move to PixiJS later if needed.
  - Svelte handles all menus.
- **Determinism:** each run records its seed plus a timestamped keystroke log. The engine can replay that log exactly. This powers resume, ghosts and leaderboard anti-cheat.
- **Data:** guest-first. Progress lives locally (IndexedDB) until the player signs in, then it's merged into their account.

---

## 5. Phases

Each phase ends with: all tests green; a playtest with 3–5 people (including someone new to typing games); the review prompt re-run with no open Blocker or Major findings; a tagged release.

### Phase 0 — Foundations & audit

- Commit the review prompt and run it on v0.1. File every finding as a GitHub issue.
- Restructure into a pnpm monorepo:
  - Move `src/engine` → `packages/engine` without changing behavior.
  - Scaffold `apps/web` (SvelteKit) around the current screens.
- Tooling: ESLint, Prettier, Vitest, Playwright smoke test, GitHub Actions CI.
- Make the engine fully deterministic from a seed plus a keystroke log:
  - Word picking uses only the run's seeded RNG.
  - Time is driven by the log.
  - Add a replay test: replaying a recorded run gives the same final state.
- Save and resume a run in progress (IndexedDB).
- Lightweight local analytics, no remote tracking yet: where players die, how long fights take, which words are typed slowest, what players choose. Feeds balance work.

### Phase 1 — Art direction & design system ("mythic ink & gold")

- Style guide:
  - Palette: deep ink blacks and underworld purples, gold filigree, ember/verdigris/moonlight accent colors per muse.
  - Texture: grain and paper textures; vignette.
- Typography, all Open Font License fonts so they're safe to open-source:
  - Display: **Cinzel** (Roman-inscription feel).
  - UI text: **Alegreya Sans**.
  - Words you type: **JetBrains Mono** or **Commit Mono**.
  - Delete the other fonts.
- Svelte component library: frame/panel with gold corners, buttons, cards with a rarity frame, tooltip panel, bars, keycaps, modal, toast.
- Motion rules:
  - Entrances ≤ 250ms.
  - Hit-stop of 40–80ms on crits.
  - Screen shake budget.
  - Full `prefers-reduced-motion` support.
- Sound: replace the synth blips with real sound effects (CC0 or commissioned), in layers: key click, hit, crit, kill, hurt, boon pick. Add a music layer that intensifies with combo. Separate volume sliders.
- Restyle every existing screen in the new system, keeping gameplay unchanged. A 1280×720 screenshot of each screen should look premium.

### Phase 2 — UX clarity & onboarding

- **Prologue:** a scripted first run, about 3 minutes:
  - Fight 1 teaches striking and targeting.
  - Fight 2 teaches combo.
  - The first reward teaches installing a mod by pressing the key.
  - Controls are taught at the moment you need them. Skippable, and replayable from settings.
- **Combat screen redesign:**
  - Big centered word lane.
  - Enemies show intent (next hit's damage plus a wind-up flash about 1s before it lands).
  - Damage preview while typing: "this word will hit for 12".
  - Readable typed/untyped colors.
  - The keyboard shows only when wanted (setting: always / hints only / off).
- **Controls:** Backspace deletes a character, like every typing site. Tab or Esc switches target. An **Esc pause menu** has resume, settings, abandon run.
- **Build panel** (hold Tab or open it between rooms): all mods on keys, relics, and how often each letter comes up.
- **Installing a mod:** shows how often each key fires, and previews its effect on the words you've seen recently.
- Keyboard-first navigation everywhere (arrows + Enter, and number keys). Visible focus rings.
- **Settings:** keyboard layouts (QWERTY/Dvorak/Colemak/AZERTY, which affects the finger map and heatmap), colorblind-safe icons alongside colors, font size, reduced motion, volume.

### Phase 3 — Gameplay depth

- **Muses**, like Hades gods: 5–6 muses. Each owns a boon family:
  - Ember (burn), Frost (control), Spark (chain), Gilt (economy), Echo (amplify), Ward (defense).
  - Boons have rarity (Common / Rare / Epic / Heroic) and levels.
  - **Duo boons** unlock when you hold boons from two muses.
  - Mods on keys stay as the way boons get installed.
- **Branching map** with doors that preview their reward (boon from muse X, coins, relic, heal, elite, shop, event). Players plan their route.
- **Enemy roster** of about 15 enemies, each with a clear behavior (shields that need a long word, casters that swap their word, splitters, word-thieves) and telegraphed attacks. **6 bosses** with multiple phases.
- **Events** between rooms: short choices, e.g. "type this cursed sentence to gain a boon, lose HP on each typo".
- **Oaths**, like the Pact of Punishment / Heat: optional difficulty modifiers that raise rewards, e.g. faster enemies, no Backspace, punctuation in words, capital letters, 1 HP of mistakes per word.
- **Rebalance:**
  - Give the sim bot a policy that makes choices (picks boons, shops) so balance is tested against realistic builds.
  - Target win rates: base game ~50% at 40 wpm for a returning player; Oath levels scale up to 90+ wpm.

### Phase 4 — Meta progression & the hub

- **The Scriptorium** hub, the place you go between runs:
  - Walk between stations with the keyboard.
  - NPCs have short dialogue that reacts to how the last run went (how you died, milestones), so every death moves the story on.
- **Currencies:**
  - Ink: common, earned in runs and practice.
  - Gold Leaf: rare, earned from bosses and Oaths.
  - Seals: from achievements.
- **Permanent upgrades**, like Hades' Mirror/Arcana: a "Codex of Hands" skill tree, deliberately small (+HP, reroll, starting boon choice, combo floor). Upgrades cost more as you buy them, so skill stays the main source of power.
- **Keyboards / quills**, like weapon aspects: the starting loadouts, unlocked through challenges and upgradable.
- **Keepsakes:** one equipped per run, levelled by using them.
- **Prophecies:** about 60 achievements (skill, build, exploration, and learning ones like "raise E's mastery to gold"), each with a reward.
- **Key mastery:** each letter has a bronze → gold rank driven by that key's speed and accuracy. Visible in the hub and on your profile. This is the "you improve through effort" loop.
- **Codex:** a bestiary and boon encyclopedia that fills in as you discover things.

### Phase 5 — Practice & Trials (Monkeytype-grade)

- **Practice mode:**
  - Timed tests of 15/30/60/120s; word counts of 10/25/50/100; quotes.
  - Toggles for punctuation and numbers.
  - Focus mode: the UI fades while you type.
  - Results: wpm, raw wpm, accuracy, consistency, a per-second graph, and the letters where you slowed down.
- **Adaptive lessons**, Keybr-style: letters unlock as you master them, driven by the existing weakness stats (`keyWeakness` in `packages/engine`).
- **Trials:** skill gates that unlock content, e.g. "60 wpm at 97% accuracy for 30s unlocks the Glass Muse". Progress comes only from actually getting better.
- Practice pays a small amount of Ink and counts toward a daily streak. It's capped so it can't be farmed.

### Phase 6 — Accounts & cloud (Supabase)

- **Sign-in:** email magic link, GitHub, Google. Playing as a guest stays fully supported. Signing in merges local progress into the account, and the merge rules are tested.
- **Database schema:**
  - `profiles`, `meta_progress`
  - `runs` (seed, starter, oaths, result, stats, compressed replay)
  - `practice_results`, `key_stats` (aggregated per user)
  - `achievements`, `user_achievements`, `daily_seeds`
- **Security:** row-level security on every table. Players can write only their own rows. Anything that affects leaderboards is written only by edge functions.
- **Sync:** offline-first queue that syncs when the player comes back online. Profile page with run history, key-mastery heatmap over time, and achievements.
- Data export and account deletion.

### Phase 7 — Competitive & social

- **Daily run:** the same seed for everyone, one attempt per day.
- **Weekly challenge:** a fixed set of Oaths.
- **Leaderboards:** daily run, practice 15/60s, highest Oath cleared. Submissions are verified by the `verify-run` edge function, which replays the keystroke log through the engine and rejects impossible timings.
- **Ghosts:** race your best replay, or a friend's, in practice.
- **Share card:** an image of the run summary with build and stats.

### Phase 8 — Open-source launch

- **Licensing:**
  - MIT for the code.
  - Assets under CC BY 4.0, or kept separate if commissioned art can't be relicensed.
  - Check every font, sound and word list for license compatibility.
- **Docs:**
  - README with a GIF.
  - CONTRIBUTING, CODE_OF_CONDUCT, SECURITY.md.
  - Architecture guide.
  - A "how to add a boon/enemy/achievement" guide, possible because content is data-driven.
  - Self-hosting guide: Supabase via its CLI running locally, plus env vars.
- **Repo setup:** issue/PR templates, labels, 20+ "good first issue"s, roadmap board.
- **Quality:**
  - Playwright end-to-end tests of a full run.
  - Lighthouse / accessibility audit.
  - Performance budget: 60 fps and < 200 KB of JS for the first screen.
  - Security review of row-level security and edge functions.
  - Remove secrets from git history before making the repo public.
- **Deploy:** Cloudflare Pages or Vercel plus hosted Supabase. Privacy policy.
- **Launch:** switch the repo to public, write release notes and a launch post.

---

## Verification (applies to every phase)

- `pnpm test`: engine unit tests, replay determinism, and the sim-bot balance guardrails, with thresholds updated each phase.
- `pnpm test:e2e`: Playwright plays the prologue and one full run headless. Covers keyboard-only navigation.
- Manual play in Chrome via claude-in-chrome, with screenshots of every screen before and after each phase.
- Re-run `docs/prompts/game-review.md`. The phase closes only when no Blocker or Major findings remain.
- From Phase 6 on: RLS tests that try to read or write another user's rows, and a test that a forged run is rejected by `verify-run`.
