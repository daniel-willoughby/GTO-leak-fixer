-- Server-side authority for the leaderboards.
--
-- Run this AFTER deploying the `publish-standings` Edge Function (not before —
-- it revokes the client's ability to write standings, so the app relies on the
-- function being live). Order:
--   1. supabase functions deploy publish-standings --project-ref <ref>
--   2. run this file in the SQL editor
--
-- After this, clients can still READ the leaderboards but can only WRITE their
-- standings through the validated Edge Function (which uses the service role
-- and so bypasses these revokes).

-- ---------------------------------------------------------------------------
-- count_crowns(uid): how many *closed* UTC days this user topped the daily
-- ladder (score desc, faster time wins ties). Recomputed from the authoritative
-- daily_scores history, so a player's crown count cannot be spoofed.
-- ---------------------------------------------------------------------------
create or replace function public.count_crowns(uid uuid)
returns int
language sql
security definer
set search_path = public
as $$
  with tops as (
    select distinct on (day) day, user_id
    from public.daily_scores
    where day < to_char((now() at time zone 'utc'), 'YYYY-MM-DD')
    order by day, score desc, time_ms asc
  )
  select count(*)::int from tops where user_id = uid;
$$;

-- Only the service role (the Edge Function) should call it.
revoke all on function public.count_crowns(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Revoke direct client writes. Reads stay open (the public leaderboard); writes
-- now go through publish-standings only. The service role ignores these grants.
-- ---------------------------------------------------------------------------
revoke insert, update on public.profiles     from anon, authenticated;
revoke insert, update on public.daily_scores from anon, authenticated;

-- (user_state stays owner-writable — it's the player's private snapshot and
--  only affects their own device's view, never the public standings.)
