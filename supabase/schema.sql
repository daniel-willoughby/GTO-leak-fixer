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
