-- Phase 7: daily runs (one attempt a day), practice ghosts, and the Oath board.

-- ---------- daily entries ----------
-- A player claims today's daily when they start it, and may claim each day once. verify-run only ranks
-- a daily run that has an open claim, then closes it by filling in run_id.
create table public.daily_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  started_at timestamptz not null default now(),
  run_id bigint references public.runs (id) on delete set null,
  primary key (user_id, day)
);

alter table public.daily_entries enable row level security;

create policy "players read their own daily entries" on public.daily_entries for select using (auth.uid() = user_id);
create policy "players claim today's daily once" on public.daily_entries for insert with check (
  auth.uid() = user_id and run_id is null and day = (now() at time zone 'utc')::date
);
-- No update or delete policies: a claim can't be undone to try again.

-- ---------- practice ghosts ----------
-- The keystrokes of a verified test, so it can be raced.
alter table public.practice_results add column replay jsonb;

alter table public.leaderboard add column practice_id bigint references public.practice_results (id) on delete set null;

create policy "leaderboard practice is public for ghosts" on public.practice_results for select using (
  verified and exists (select 1 from public.leaderboard l where l.practice_id = practice_results.id)
);

create or replace view public.leaderboard_named with (security_invoker = true) as
  select l.board, l.user_id, coalesce(p.username, 'Scribe ' || left(l.user_id::text, 4)) as username, l.score, l.detail, l.run_id,
         l.updated_at, rank() over (partition by l.board order by l.score desc, l.updated_at asc) as rank, l.practice_id
  from public.leaderboard l left join public.profiles p on p.id = l.user_id;
