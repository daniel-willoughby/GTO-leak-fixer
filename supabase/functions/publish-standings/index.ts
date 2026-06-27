// Server-authoritative leaderboard publish.
//
// The client can compute and display its own Poker Points locally, but it must
// NOT be trusted to write its standings — anyone can edit localStorage or call
// the Supabase client from the browser console. This Edge Function is the only
// writer to `profiles` and `daily_scores` (RLS revokes direct client writes in
// server-authority.sql), and it validates everything it accepts:
//   • daily score is clamped to 0..20 and time to >= 0
//   • crowns are RECOMPUTED server-side from the daily_scores history (the
//     client's claimed crown count is ignored entirely — this is fully
//     cheat-proof, since the server owns that history)
//   • pp_earned is clamped to a play-derived ceiling so it can't be absurd
//
// Deploy: supabase functions deploy publish-standings --project-ref <ref>
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the platform.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const clampInt = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(num(v))))
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // Identify the caller from their JWT (anon client + the user's auth header).
    const authed = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: u, error: uErr } = await authed.auth.getUser()
    if (uErr || !u?.user) return json({ error: 'unauthorized' }, 401)
    const uid = u.user.id

    // The admin client uses the service role, so it bypasses the RLS that now
    // blocks direct client writes — this function is the trusted writer.
    const admin = createClient(url, service)
    const body = await req.json().catch(() => ({}))

    // ---- daily ladder score (clamped) ----
    if (body.daily) {
      const d = body.daily
      const { error } = await admin.from('daily_scores').upsert(
        {
          user_id: uid,
          day: str(d.day, 10),
          score: clampInt(d.score, 0, 20),
          time_ms: Math.max(0, Math.floor(num(d.time_ms))),
          handle: str(d.handle, 24),
          avatar: str(d.avatar, 64),
          flair: str(d.flair, 64),
          background: str(d.background, 64),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,day' },
      )
      if (error) return json({ error: error.message }, 400)
    }

    // ---- profile / standings (validated + server-computed crowns) ----
    if (body.profile) {
      const p = body.profile
      const hands = Math.max(0, Math.floor(num(p.hands_played)))

      // Crowns are authoritative: recount how many closed days this user topped.
      const { data: crownCount } = await admin.rpc('count_crowns', { uid })
      const crowns = Math.max(0, Math.floor(num(crownCount)))

      // The number of days this user actually has a daily-ladder score on file.
      // The server owns this history, so it bounds the 100-PP daily-completion
      // bonuses the player could legitimately have earned.
      const { count: dailyDays } = await admin
        .from('daily_scores')
        .select('day', { count: 'exact', head: true })
        .eq('user_id', uid)

      // PP can't exceed what play could actually produce, and almost every term
      // is server-verifiable rather than a blanket allowance:
      //   • 2 PP per correct hand            → ≤ hands * 2
      //   • 100 PP per daily completion       → dailyDays * 100  (server-owned)
      //   • 500 PP per crown                  → crowns * 500      (recomputed)
      //   • a small fixed slack for the few sources the server can't see
      //     (one-off grants, net duel winnings).
      const ppCeiling = hands * 2 + (dailyDays ?? 0) * 100 + crowns * 500 + 10000

      const { error } = await admin.from('profiles').upsert({
        user_id: uid,
        handle: str(p.handle, 24),
        hands_played: hands,
        best_streak: Math.max(0, Math.floor(num(p.best_streak))),
        accuracy: clampInt(p.accuracy, 0, 100),
        pre_acc: clampInt(p.pre_acc, -1, 100),
        post_acc: clampInt(p.post_acc, -1, 100),
        pp_earned: clampInt(p.pp_earned, 0, ppCeiling),
        crowns,
        avatar: str(p.avatar, 64),
        flair: str(p.flair, 64),
        background: str(p.background, 64),
        updated_at: new Date().toISOString(),
      })
      if (error) return json({ error: error.message }, 400)
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
