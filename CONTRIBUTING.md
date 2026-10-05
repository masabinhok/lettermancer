# Contributing to Lettermancer

Thanks for helping. Lettermancer is a typing roguelike built by a small community. This guide covers how to get it
running, what a good change looks like, and how reviews work.

## Getting set up

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # engine rules, replays, and the balance bot
npm run test:e2e     # Playwright
```

Accounts and leaderboards are optional; you only need them for cloud work. See
[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) to run Supabase locally.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before a larger change. To add enemies, boons, relics, events or
prophecies, see [docs/ADDING_CONTENT.md](docs/ADDING_CONTENT.md).

## Finding something to work on

- Issues labelled **good first issue** are small and self-contained, with pointers to the files involved.
- Issues labelled **help wanted** are bigger but agreed on.
- For a new feature or mechanic, open an issue first so we can agree on the design before you build it.

## Making a change

1. Fork, then branch from `develop` (see [Branches](#branches)).
2. Keep the change focused. One fix or feature per pull request.
3. Before pushing, run:
   ```bash
   npm run format && npm run lint && npm run check && npm test && npm run test:e2e
   ```
4. Open a pull request using the template. Include screenshots for anything visible.

### Ground rules for the engine

- **Keep it deterministic.** No `Math.random()`, `Date.now()` or `performance.now()` in `packages/engine`. Use the
  seeded streams and the `at` passed in with each action. Replays, saves and server verification all depend on it.
- **Bump `RULES_VERSION`** when existing runs would play out differently.
- **Add a test** for each new rule. If balance changes on purpose, update the sim-bot thresholds and explain why in
  the PR.

### Ground rules for the web app

- Everything must be playable with the keyboard alone. Every action gets a hotkey or is reachable with Tab and arrows.
- Use the design tokens in `apps/web/src/app.css`. Gold is for ornament and rewards; muse colors mark empowered keys.
- Text is plain and short. Say what a thing does in numbers ("+3 health"), not flavor alone.
- Check layouts at 1280×720, the smallest size we design for.

### Cloud changes

- Every new table needs row-level security, and a test in `tests/cloud/` that tries to read and write another
  player's rows.
- Anything that affects a leaderboard is written only by an edge function.

## Branches

Lettermancer uses git-flow:

| Branch            | What it holds                                                                                                                                   | Deploys to |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `main`            | Released code only. Every merge is a tagged release (`v1.0.0`, `v1.0.1`, …).                                                                    | Production |
| `develop`         | The next release. Finished features and fixes land here.                                                                                        | Preview    |
| `feature/<name>`  | One feature or fix. Branch from `develop`, open a pull request back into `develop`.                                                             | Preview    |
| `release/<x.y.z>` | Cut from `develop` to prepare a release: version bump, release notes, last fixes. Merged into `main` (tagged `vx.y.z`) and back into `develop`. | Preview    |
| `hotfix/<x.y.z>`  | An urgent fix to what's live. Branch from `main`; merge into `main` (tagged) and `develop`.                                                     | Preview    |

Pull requests target `develop`, never `main`. If a release changes the rules (`RULES_VERSION`), the edge functions are
redeployed with it (see [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)).

## Commit messages

Write in the imperative, and say what changed and why: "Telegraph enemy attacks a second earlier", not "fix stuff".

## Code of conduct

Everyone taking part agrees to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
