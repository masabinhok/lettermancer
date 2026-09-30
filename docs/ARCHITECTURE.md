# Architecture

Keycraft is a static web app with an optional backend. The rules of the game live in one deterministic engine that
runs in the browser and, unchanged, on the server.

```
┌──────────────────────── browser ────────────────────────┐        ┌────────────── Supabase ──────────────┐
│ apps/web (SvelteKit, static)                            │        │ Postgres + row-level security        │
│   routes/     title hub, run, practice, profile,        │        │   profiles, progress, runs,          │
│               leaderboards, login, prologue, privacy    │  auth  │   practice_results, leaderboard,     │
│   lib/game/   Session: real-time clock over the engine  │◀──────▶│   daily_entries                      │
│   lib/cloud/  account: sign-in, sync, outbox, submit    │  REST  │                                      │
│   lib/stores/ profile (localStorage)                    │        │ Edge functions (Deno)                │
│                                                         │  POST  │   verify-run      ─┐ same engine,    │
│ packages/engine (pure TypeScript, no DOM)  ─────────────┼───────▶│   verify-practice ─┤ bundled to      │
│   RunMachine, combat, content, meta, practice, online   │        │   delete-account   │ _shared/engine  │
└─────────────────────────────────────────────────────────┘        └──────────────────────────────────────┘
```

## The engine (`packages/engine`)

- **Deterministic.** A run is a `RunConfig` (seed, keyboard, Oaths, bonuses, mode, and a snapshot of the player's weak
  keys) plus a list of `Action`s. `RunMachine.replay(config, actions)` always rebuilds the same state. Every source of
  randomness comes from seeded streams (`rng.ts`). Time is passed in as `at` on each action, never read from a
  clock.
- **Fixed-step time.** Combat advances in fixed ticks up to each action's `at`, so a replay on a slow server matches
  the browser exactly.
- **Content is data.** Enemies, bosses, events, boons, relics, prophecies, trials and quotes are plain objects in
  `src/content` and `src/mods.ts`. See [ADDING_CONTENT.md](ADDING_CONTENT.md).
- **Meta progression** (`meta.ts`, `content/progression.ts`) turns permanent upgrades and keepsakes into plain-number
  `RunBonuses` that go into the config. Replays don't depend on the player's profile.
- **`RULES_VERSION`** is stamped on every config. Old saves and old submissions are refused instead of replaying
  under new rules.
- **`online.ts`** holds what must match between browser and server: shared seeds (`seedFor`, `dailyLabel`,
  `weeklyLabel`, `weeklyOaths`, `dailyStarter`, `sharedRunConfig`), verification (`verifyRun`, `replayPractice`), and
  the progress merge rules (`mergeMeta`).

## The web app (`apps/web`)

- **SvelteKit with `adapter-static`**, built as a single-page app. There's no server-side rendering and no server
  of our own.
- **`Session`** (`lib/game/session.svelte.ts`) wraps a `RunMachine` with a `requestAnimationFrame` clock, pause
  handling, an event feed for effects and sound, and autosave (the config plus actions go to `localStorage`, so a
  reload resumes mid-fight).
- **`profile`** (`lib/stores/profile.svelte.ts`) holds meta progress, key stats and settings in `localStorage`. The
  game is complete without an account.
- **`account`** (`lib/cloud/account.svelte.ts`) is only active when `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` are set at build time. It handles:
  - sign-in (magic link, GitHub, Google);
  - syncing progress with `mergeMeta`;
  - an offline outbox for submissions;
  - daily claims, leaderboards, ghosts, data export and account deletion.
- **Sound** is synthesized with Web Audio, and **art** is CSS and SVG. There are no binary assets to license.

## The cloud (`supabase/`)

- **Schema** in `migrations/`. Every table has row-level security. Players read and write only their own rows.
  Leaderboards are public to read, and so are the replays they link to (for ghosts).
- **Trust boundary.** The browser can record _unverified_ runs for its own history. Only edge functions (service role)
  can:
  - mark a run verified;
  - write the `leaderboard`;
  - close a daily claim.
- **`verify-run`** replays the log with the bundled engine and checks four things:
  - the config (a known keyboard, legal Oaths, bonuses that real progress can produce, and no bonuses or weak-key bias
    on shared runs);
  - the seed for daily and weekly runs;
  - that the run actually finished;
  - keystroke timing (too many gaps under 25 ms, or a fight above 250 wpm, is rejected).

  A daily must have been claimed in `daily_entries` when it started, and each day can be claimed once.

- **`verify-practice`** replays practice keystrokes, stores the replay, and ranks 15 s and 60 s tests at 90% accuracy
  or better.
- **The engine bundle.** `npm run bundle:engine` builds `supabase/functions/_shared/engine.js` from the engine
  source. It's gitignored and rebuilt before starting or deploying functions.

## Data flow of a ranked run

1. The hub starts a daily: `account.claimDaily()` inserts today's row in `daily_entries`. RLS allows only today, and
   only once.
2. `Session.fromConfig(sharedRunConfig('daily', …))` runs the game. Every action is recorded.
3. On `run-end`, the session posts `{ config, actions }` to `verify-run`. If the player is offline, the outbox keeps
   it and sends it when they reconnect.
4. The function replays the run, stores it with `verified = true`, closes the daily claim, and posts to the boards:
   `daily:<date>`, `weekly:<week>`, `all-time`, and `heat` for wins under Oaths.
5. The results screen shows the returned ranks. `/leaderboards` reads the `leaderboard_named` view.

## Tests

| Where                    | What                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| `packages/engine/tests/` | Rules, replay determinism, verification, merge rules, and the balance bot         |
| `apps/web/src/**/*.test` | Small web-side units                                                              |
| `e2e/`                   | Playwright: tutorial, fights, resume, hub, practice, daily/weekly, leaderboards   |
| `tests/cloud/`           | Against local Supabase: RLS attacks, forged runs, daily once-only, ghosts, delete |
| `e2e/cloud/`             | Magic-link sign-in, name, sync in a real browser                                  |
