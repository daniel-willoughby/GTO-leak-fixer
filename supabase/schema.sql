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
-- accuracy split by street (percent; -1 = no hands yet on that street)
alter table public.profiles add column if not exists pre_acc    integer not null default -1;
alter table public.profiles add column if not exists post_acc   integer not null default -1;
-- daily "crowns": how many times this player topped the daily ladder at reset
alter table public.profiles add column if not exists crowns     integer not null default 0;

create table if not exists public.daily_scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        text not null,             -- shared UTC YYYY-MM-DD
  score      integer not null default 0,
  time_ms    integer not null default 0,
  handle     text not null default 'Player',
  avatar     text,
  flair      text,
  background text,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
-- background added after initial release; harmless if the table already exists.
alter table public.daily_scores add column if not exists background text;

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

-- ---------------------------------------------------------------------------
-- Friend requests: a small inbox so a player is *notified* when someone adds
-- them. The sender writes a row (with their denormalised name/avatar/flair for
-- a cheap render); the recipient reads their inbox and either accepts (adds
-- back) or dismisses — both just delete the row. One pending row per (from,to).
-- ---------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references auth.users (id) on delete cascade,
  to_user     uuid not null references auth.users (id) on delete cascade,
  from_handle text,
  from_avatar text,
  from_flair  text,
  created_at  timestamptz not null default now(),
  unique (from_user, to_user)
);

alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests read involved"   on public.friend_requests;
drop policy if exists "friend_requests insert own"      on public.friend_requests;
drop policy if exists "friend_requests delete involved" on public.friend_requests;

-- both parties can see a request that involves them
create policy "friend_requests read involved"
  on public.friend_requests for select
  using (auth.uid() = from_user or auth.uid() = to_user);

-- you can only send a request *as* yourself
create policy "friend_requests insert own"
  on public.friend_requests for insert
  with check (auth.uid() = from_user);

-- recipient accepts/dismisses, sender can cancel — all are a delete
create policy "friend_requests delete involved"
  on public.friend_requests for delete
  using (auth.uid() = from_user or auth.uid() = to_user);

create index if not exists friend_requests_to_idx
  on public.friend_requests (to_user, created_at desc);

-- Friend requests are private to the two parties (no anon read).
grant select, insert, delete on public.friend_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Duels: a head-to-head 10-question challenge between two friends, optionally
-- for a PP wager. Both play the *same* 10 spots (seeded from `seed`). The
-- challenger creates the row already holding their score; the opponent accepts
-- and plays, which fills their score and flips status to 'done'. Denormalised
-- handles/avatars for cheap render. Wager settlement is client-side for now.
-- ---------------------------------------------------------------------------
create table if not exists public.duels (
  id                uuid primary key default gen_random_uuid(),
  challenger        uuid not null references auth.users (id) on delete cascade,
  challenger_handle text,
  challenger_avatar text,
  opponent          uuid not null references auth.users (id) on delete cascade,
  opponent_handle   text,
  opponent_avatar   text,
  wager             integer not null default 0,
  seed              text not null,
  status            text not null default 'pending', -- pending | done | declined
  challenger_score  integer,
  challenger_time   integer,
  opponent_score    integer,
  opponent_time     integer,
  created_at        timestamptz not null default now()
);

alter table public.duels enable row level security;

drop policy if exists "duels read involved"   on public.duels;
drop policy if exists "duels insert own"       on public.duels;
drop policy if exists "duels update involved"  on public.duels;

-- both players can see a duel they're in
create policy "duels read involved"
  on public.duels for select
  using (auth.uid() = challenger or auth.uid() = opponent);

-- you can only create a duel *as* the challenger
create policy "duels insert own"
  on public.duels for insert
  with check (auth.uid() = challenger);

-- either player can update (opponent submits their score / declines)
create policy "duels update involved"
  on public.duels for update
  using (auth.uid() = challenger or auth.uid() = opponent)
  with check (auth.uid() = challenger or auth.uid() = opponent);

create index if not exists duels_opponent_idx on public.duels (opponent, created_at desc);
create index if not exists duels_challenger_idx on public.duels (challenger, created_at desc);

-- Duels are private to the two players.
grant select, insert, update on public.duels to authenticated;
