# Good first issues (drafts to file at launch)

Each is small, self-contained, and names the files to start from. File them with the labels shown. Suggested labels
for the repo: `good first issue`, `help wanted`, `bug`, `idea`, `content`, `engine`, `web`, `cloud`, `a11y`, `docs`.

| #   | Title                                                                | Labels          | Start here                                            |
| --- | -------------------------------------------------------------------- | --------------- | ----------------------------------------------------- |
| 1   | Show a countdown to the next daily rite on the hub card              | web             | `apps/web/src/routes/+page.svelte`                    |
| 2   | Leaderboards: load more than the top 50                              | web, cloud      | `routes/leaderboards/+page.svelte`, `account.board()` |
| 3   | Show "updated 3 h ago" next to each leaderboard entry                | web             | `routes/leaderboards/+page.svelte`                    |
| 4   | Practice ghosts: show the ghost's live wpm beside yours              | web, engine     | `routes/practice/+page.svelte`, `ghostTrack`          |
| 5   | "Copy ghost link" button on the practice result screen               | web             | `routes/practice/+page.svelte`                        |
| 6   | Share card: list blessings and the carried keepsake                  | web             | `apps/web/src/lib/game/shareCard.ts`                  |
| 7   | Share card: use the Web Share API on phones                          | web             | `shareCard.ts` (`shareCard()`)                        |
| 8   | Results: name the weekly Oaths that were in effect                   | web             | `lib/screens/Results.svelte`                          |
| 9   | Profile: a calendar strip of the dailies you've played               | web, cloud      | `routes/profile/+page.svelte`, `daily_entries`        |
| 10  | New prophecy: play the daily rite seven days in a row                | content, engine | `content/prophecies.ts`                               |
| 11  | Add ten more public-domain quotes with sources                       | content         | `content/quotes.ts`                                   |
| 12  | Add the Colemak-DH keyboard layout and finger colors                 | web             | `lib/game/layouts.ts`                                 |
| 13  | Respect `prefers-reduced-motion` for screen shake and particles      | a11y, web       | `lib/fx/particles.ts`, `app.css`                      |
| 14  | Announce combo tier changes to screen readers                        | a11y, web       | `lib/screens/Combat.svelte`                           |
| 15  | Codex: filter by muse and search by name                             | web             | `lib/hub/Codex.svelte`                                |
| 16  | e2e: play the leaderboards page with only arrow keys and number keys | web, tests      | `e2e/smoke.spec.ts`                                   |
| 17  | e2e: a signed-in weekly run posts to "This week"                     | tests, cloud    | `e2e/cloud/`, `tests/cloud/cloud.test.ts`             |
| 18  | Engine test: `sharedRunConfig` gives everyone the same first fight   | engine, tests   | `packages/engine/tests/online.test.ts`                |
| 19  | Add a web app manifest and icons so the game can be installed        | web             | `apps/web/static/`, `apps/web/src/app.html`           |
| 20  | Lazy-load the Supabase client so guests download less JavaScript     | web, perf       | `lib/cloud/client.ts`, `account.svelte.ts`            |
| 21  | Leaderboards: link a run row to its replay summary                   | web, cloud      | `routes/leaderboards/+page.svelte`, `runs.report`     |
| 22  | Docs: a short GIF for each boss in the README                        | docs            | `README.md`, `scripts/playtest.mjs`                   |

## Template for each issue

> **What:** one sentence.
>
> **Why:** the player-facing reason.
>
> **Where to start:** the files above. Read `CONTRIBUTING.md` first.
>
> **Done when:** the behaviour works with the keyboard alone and `npm test` / `npm run test:e2e` pass (add a test
> where it makes sense).

## Roadmap board

Suggested columns for a GitHub Project: **Ideas → Agreed → In progress → Review → Shipped**. Seed it with the issues
above, plus issue #19 (the human playtest).
