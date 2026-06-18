import { useEffect, useState } from 'react'
import { Trophy, Check, Flame } from 'lucide-react'
import { getAchievements, type Achievement } from '../lib/achievements'
import { fetchLeaderboard, getHandle, setHandle, upsertProfile, type LeaderRow } from '../lib/leaderboard'
import { gatherLocal } from '../lib/sync'

const GROUPS: Achievement['group'][] = ['Volume', 'Accuracy', 'Streaks', 'Learning']

function Row({ a }: { a: Achievement }) {
  const Icon = a.icon
  const pct = Math.round(a.progress * 100)
  return (
    <div className={`rounded-xl border p-3.5 ${a.done ? 'bg-sage/10 border-sage/30' : 'bg-paper2 border-line'}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            a.done ? 'bg-sage text-white dark:text-paper animate-spring' : 'bg-ink/[0.06] text-ink3'
          }`}
        >
          {a.done ? <Check size={18} /> : <Icon size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-semibold ${a.done ? 'text-sage-dark' : 'text-ink'}`}>{a.title}</span>
            <span className="shrink-0 text-xs tabular-nums text-ink3">{a.label}</span>
          </div>
          <p className="text-[13px] text-ink2 leading-snug">{a.desc}</p>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className={`h-full rounded-full transition-all ${a.done ? 'bg-sage' : 'bg-sage/60'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface Props {
  version: number
  /** Cloud sync configured (env vars present). */
  configured: boolean
  /** Signed-in user id, or null. */
  userId: string | null
  /** Open the account / sign-in modal. */
  onSignIn: () => void
}

export default function AchievementsScreen({ version, configured, userId, onSignIn }: Props) {
  const [items, setItems] = useState<Achievement[] | null>(null)
  const [board, setBoard] = useState<LeaderRow[] | null>(null)
  const [handle, setHandleState] = useState(getHandle())

  useEffect(() => {
    getAchievements().then(setItems)
  }, [version])

  useEffect(() => {
    if (configured && userId) fetchLeaderboard().then(setBoard)
    else setBoard(null)
  }, [configured, userId, version])

  async function saveHandle() {
    setHandle(handle)
    if (userId) {
      await upsertProfile(userId, await gatherLocal())
      setBoard(await fetchLeaderboard())
    }
  }

  if (!items) return null
  const done = items.filter((a) => a.done).length

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-2xl mx-auto flex flex-col gap-5">
      <div className="panel flex items-center gap-3 p-4">
        <Trophy size={26} className="shrink-0 text-clay" />
        <div>
          <h1 className="serif text-xl">Achievements</h1>
          <p className="text-sm text-ink2">
            {done} of {items.length} unlocked. Keep drilling to fill the bars.
          </p>
        </div>
      </div>

      {GROUPS.map((g) => {
        const rows = items.filter((a) => a.group === g)
        if (!rows.length) return null
        return (
          <section key={g} className="flex flex-col gap-2.5">
            <h2 className="text-xs uppercase tracking-wide text-ink3 px-1">{g}</h2>
            {rows.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </section>
        )
      })}

      {configured && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-xs uppercase tracking-wide text-ink3 px-1">Leaderboard</h2>
          {!userId ? (
            <div className="panel flex items-center justify-between gap-3 p-4 text-sm text-ink2">
              <span>Sign in to compare streaks with everyone.</span>
              <button onClick={onSignIn} className="btn btn-primary shrink-0 px-3 py-2 text-sm">
                Sign in
              </button>
            </div>
          ) : (
            <>
              <div className="panel flex items-center gap-2 p-3">
                <span className="shrink-0 text-xs text-ink3">Your name</span>
                <input
                  value={handle}
                  onChange={(e) => setHandleState(e.target.value)}
                  onBlur={saveHandle}
                  placeholder="Player"
                  maxLength={24}
                  className="flex-1 border-b border-line bg-transparent py-1 text-sm outline-none focus:border-sage"
                />
              </div>
              {board === null ? (
                <p className="px-1 text-sm text-ink2">Loading…</p>
              ) : board.length === 0 ? (
                <p className="px-1 text-sm text-ink2">No players yet, be the first.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {board.map((r, i) => (
                    <div
                      key={r.user_id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        r.user_id === userId ? 'bg-sage/10 border-sage/30' : 'bg-paper2 border-line'
                      }`}
                    >
                      <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-ink3">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.handle}</span>
                      <span className="flex shrink-0 items-center gap-1 text-sm text-clay">
                        <Flame size={13} /> {r.best_streak}
                      </span>
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink2">{r.accuracy}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
