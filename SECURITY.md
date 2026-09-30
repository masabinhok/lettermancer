# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](../../security/advisories/new) on this repository instead. Include what you found,
how to reproduce it, and what an attacker could do with it.

You'll get a reply within a week. Once it's fixed, we'll credit you in the release notes if you'd like.

## What counts

Anything that lets someone:

- read or change another player's progress, runs, practice results or account;
- get onto a leaderboard without a real, verified run or test (for example, bypassing `verify-run` or
  `verify-practice`);
- write to tables that only edge functions should write (`leaderboard`, verified `runs`, `daily_entries.run_id`);
- run code in another player's browser.

Leaderboard cheating that stays within human timing (a very good player, or a macro that types at human speed) is a
known limit of client-side games. Report it as a normal issue.

## How the cloud side is protected

- Every table has row-level security. Players can read and write only their own rows. Leaderboards, and the practice
  replays linked from them, are public to read.
- The `leaderboard` table has no write policies at all. Only edge functions, which hold the service-role key, can
  write to it.
- `verify-run` and `verify-practice` replay each submission with the same engine the browser uses. They reject
  unfinished or invalid logs, inhuman keystroke timing, impossible starting bonuses or Oaths, the wrong daily or weekly
  seed, and a second daily.
- The service-role key lives only in the edge function environment and is never shipped to the browser.

The tests in `tests/cloud/` try these attacks against a local Supabase on every CI run.

## Known limits

These are accepted trade-offs of a client-side game. Please report them as ordinary issues if you see them abused:

- The daily's seed is public, so someone could rehearse it (as a guest or on another account) before playing their
  one ranked attempt.
- Practice tests use a seed the browser picks. A player could hunt for a seed with easier words before a ranked test.
- Timing checks catch bots, not assisted humans. A macro or on-screen helper that types at human speed passes.
- Unlocked keyboards aren't checked against the player's progress. Only the bonuses a run starts with are checked.
