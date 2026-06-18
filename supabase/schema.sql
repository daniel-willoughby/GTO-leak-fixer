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
