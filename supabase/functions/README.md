# Edge Functions — server-authoritative leaderboards

`publish-standings` is the only trusted writer to the public leaderboard tables.
The web client computes Poker Points locally for display, but it can no longer
write its own standings — it sends them to this function, which **validates**
them (clamps the daily score to 0–20, clamps PP to a play-derived ceiling) and
**recomputes crowns server-side** from the `daily_scores` history, so a crown
count cannot be faked.

This does not (and cannot) stop someone reading the client JavaScript — that's
inherent to any web app. It stops a tampered client from changing the *official*
standings, which is the part that actually matters.

## Deploy (you run this — it needs your Supabase auth)

```bash
# one-time: install + log in (opens a browser)
brew install supabase/tap/supabase
supabase login

# deploy the function to your project
supabase functions deploy publish-standings --project-ref <your-project-ref>
```

The platform injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` automatically — no secrets to set.

## Then lock the tables (order matters)

After the function is live, run `supabase/server-authority.sql` in the SQL
editor. It adds the `count_crowns()` helper and **revokes direct client writes**
to `profiles` / `daily_scores`. Do this *after* deploying — it relies on the
function being available.

The client already prefers the function and falls back to a direct write when
it isn't deployed, so there's no downtime: before you deploy, the fallback keeps
working; once you deploy + run the SQL, the direct path is blocked and only the
validated function path remains.

## Remaining gap (honest note)

`pp_earned` is still derived from the client's decision log, which the client
supplies — clamping caps absurd values but a determined user could still inflate
within the cap by fabricating decisions. Making PP fully authoritative would
require the server to also generate/score the spots (a larger follow-up).
**Crowns and daily scores are fully server-validated.**
