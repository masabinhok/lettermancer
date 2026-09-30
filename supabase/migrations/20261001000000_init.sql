-- Keycraft schema. Every table has row-level security. Players read and write only their own rows;
-- anything that affects leaderboards is written only by edge functions using the service role.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "players insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "players update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create a profile row for every new account.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- progress (meta, stats, settings) ----------
create table public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  meta jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "players read their own progress" on public.progress for select using (auth.uid() = user_id);
create policy "players insert their own progress" on public.progress for insert with check (auth.uid() = user_id);
create policy "players update their own progress" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- runs ----------
create table public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  seed bigint not null,
  starter text not null,
  mode text not null default 'standard' check (mode in ('standard', 'daily', 'weekly')),
  heat int not null default 0,
  gentle boolean not null default false,
  result text not null check (result in ('won', 'lost')),
  act int not null,
  score int not null,
  words int not null,
  max_combo int not null,
  peak_wpm real not null,
  accuracy real not null,
  report jsonb not null,
  -- The full action log. Verified runs can be replayed exactly (and raced as ghosts).
  replay jsonb,
  -- Only the verify-run edge function sets this, after replaying the run on the server.
  verified boolean not null default false
);

create index runs_user_created on public.runs (user_id, created_at desc);

alter table public.runs enable row level security;

create policy "players read their own runs" on public.runs for select using (auth.uid() = user_id);
-- Players may record unverified runs for their history; they can never mark one verified.
create policy "players record their own unverified runs" on public.runs
  for insert with check (auth.uid() = user_id and verified = false);

-- ---------- practice ----------
create table public.practice_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  test_id text not null,
  wpm int not null,
  raw int not null,
  accuracy real not null,
  consistency int not null,
  seconds int not null,
  trial text,
  verified boolean not null default false
);

create index practice_user_created on public.practice_results (user_id, created_at desc);

alter table public.practice_results enable row level security;

create policy "players read their own practice" on public.practice_results for select using (auth.uid() = user_id);
create policy "players record their own unverified practice" on public.practice_results
  for insert with check (auth.uid() = user_id and verified = false);

-- ---------- leaderboards ----------
-- One row per player per board, holding their best verified score. Written only by edge functions.
create table public.leaderboard (
  board text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  score numeric not null,
  detail jsonb not null default '{}'::jsonb,
  run_id bigint references public.runs (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (board, user_id)
);

create index leaderboard_board_score on public.leaderboard (board, score desc);

alter table public.leaderboard enable row level security;

create policy "leaderboards are public" on public.leaderboard for select using (true);
-- No insert/update/delete policies: only the service role (edge functions) can write.

create view public.leaderboard_named with (security_invoker = true) as
  select l.board, l.user_id, coalesce(p.username, 'Scribe ' || left(l.user_id::text, 4)) as username, l.score, l.detail, l.run_id,
         l.updated_at, rank() over (partition by l.board order by l.score desc, l.updated_at asc) as rank
  from public.leaderboard l left join public.profiles p on p.id = l.user_id;

-- ---------- ghosts ----------
-- Best verified runs can be raced. Players may read the replay of any run on a leaderboard.
create policy "leaderboard runs are public for ghosts" on public.runs for select using (
  verified and exists (select 1 from public.leaderboard l where l.run_id = runs.id)
);

-- Daily and weekly seeds come from the engine (seedFor), shared by the browser and the edge functions.

-- ---------- account deletion ----------
-- Deleting the auth user cascades to every table above.
