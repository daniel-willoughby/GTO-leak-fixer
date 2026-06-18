-- LeakTutor cloud sync schema. Run this once in the Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run).
--
-- One row per user holds a JSON snapshot of their progress (leaks, streak,
-- lessons, settings). Row-level security ensures each user can only read and
-- write their own row, so the public anon key is safe to ship in the client.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "user_state read own"   on public.user_state;
drop policy if exists "user_state insert own"  on public.user_state;
drop policy if exists "user_state update own"  on public.user_state;

create policy "user_state read own"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "user_state insert own"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "user_state update own"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Public leaderboard profile: one row per user with shareable summary stats.
-- Readable by everyone (the leaderboard), writable only by its owner. Holds no
-- private data — just a chosen handle and headline numbers.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  handle       text not null default 'Player',
  hands_played integer not null default 0,
  best_streak  integer not null default 0,
  accuracy     integer not null default 0,
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read all"   on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;

create policy "profiles read all"
  on public.profiles for select
  using (true);

create policy "profiles insert own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Game layer: Poker Points + cosmetics on the profile, and a per-day ladder
-- score table that powers the daily leaderboard. All public-read; owner-write.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists pp_earned  integer not null default 0;
alter table public.profiles add column if not exists avatar     text;
alter table public.profiles add column if not exists flair      text;
alter table public.profiles add column if not exists background text;

create table if not exists public.daily_scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        text not null,             -- shared UTC YYYY-MM-DD
  score      integer not null default 0,
  time_ms    integer not null default 0,
  handle     text not null default 'Player',
  avatar     text,
  flair      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- best score first, faster total time breaks ties
create index if not exists daily_scores_rank on public.daily_scores (day, score desc, time_ms asc);

alter table public.daily_scores enable row level security;

drop policy if exists "daily read all"   on public.daily_scores;
drop policy if exists "daily insert own" on public.daily_scores;
drop policy if exists "daily update own" on public.daily_scores;

create policy "daily read all"
  on public.daily_scores for select
  using (true);

create policy "daily insert own"
  on public.daily_scores for insert
  with check (auth.uid() = user_id);

create policy "daily update own"
  on public.daily_scores for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Role grants. RLS policies only take effect once the role also holds the
-- underlying table privilege — without these GRANTs every request is denied
-- with "permission denied for table" *before* the policy is ever evaluated.
-- (Supabase auto-grants for tables made via the Table Editor, but NOT for
-- tables created here in the SQL editor — hence this block.)
--   anon          = signed-out visitors (public leaderboard reads)
--   authenticated = signed-in users (their own writes + leaderboard reads)
-- ---------------------------------------------------------------------------

-- Private per-user snapshot: only the owner (an authenticated session) touches it.
grant select, insert, update on public.user_state to authenticated;

-- Public leaderboard profile: everyone reads, owner writes.
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- Daily ladder scores: everyone reads, owner writes.
grant select on public.daily_scores to anon, authenticated;
grant insert, update on public.daily_scores to authenticated;
