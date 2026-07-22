import { useEffect, useState } from 'react'
import { Trophy, CloudOff } from 'lucide-react'
import { fetchLatestDailyBoard, dailyPublishPending, type DailyRow } from '../lib/leaderboard'
import { dayKey, prevDay } from '../lib/daily'
import { LADDER_LEN } from '../lib/dailyLadder'
import { Avatar, Flair } from './Avatar'

interface Props {
  configured: boolean
  userId: string | null
  /** Bump to refetch after a fresh ladder run. */
  version: number
}

/** Compact today's-leaderboard shown beneath the daily challenge card. */
export default function DailyLeaderboard({ configured, userId, version }: Props) {
  const [rows, setRows] = useState<DailyRow[] | null>(null)
  const [shownDay, setShownDay] = useState<string>(dayKey())

  useEffect(() => {
    if (!configured) return
    fetchLatestDailyBoard().then(({ day, rows }) => {
      setShownDay(day)
      setRows(rows)
    })
  }, [configured, version])

  if (!configured) return null

  // The ladder day is UTC, so today's board is empty until someone plays after
  // 00:00 UTC. Say which day is on screen when it isn't today's.
  const today = dayKey()
  const heading =
    shownDay === today ? "Today's leaderboard" : shownDay === prevDay(today) ? "Yesterday's leaderboard" : `Leaderboard · ${shownDay}`

  // Today's run finished but never reached the server (signed out, or a failed
  // post). Say so, otherwise the row is just silently missing and the board
  // looks broken.
  const pending = dailyPublishPending(dayKey())

  return (
    <section className="mt-4 flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 px-1 text-xs uppercase tracking-wide text-ink3">
        <Trophy size={13} className="text-clay" /> {heading}
      </h2>
      {pending && (
        <div className="flex items-start gap-2 rounded-lg border border-clay/30 bg-clay/[0.07] px-3 py-2 text-xs text-ink2">
          <CloudOff size={13} className="mt-0.5 shrink-0 text-clay" />
          <span>
            {userId
              ? "Your score today hasn't posted yet. It will publish automatically when you reconnect."
              : 'Your score today is saved on this device only. Sign in to post it to the leaderboard.'}
          </span>
        </div>
      )}
      <div className="panel flex flex-col divide-y divide-line overflow-hidden">
        {rows === null ? (
          <p className="p-4 text-center text-sm text-ink3">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-ink3">No scores yet today. Be the first to climb.</p>
        ) : (
          rows.slice(0, 10).map((r, i) => {
            const me = r.user_id === userId
            return (
              <div
                key={r.user_id}
                className={`flex items-center gap-3 px-3 py-2.5 ${me ? 'bg-sage/[0.08]' : ''}`}
              >
                <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-ink3">{i + 1}</span>
                <Avatar id={r.avatar} background={r.background} size={28} />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-ink">{r.handle}</span>
                  <Flair id={r.flair} size={13} />
                  {me && <span className="text-[10px] font-bold uppercase tracking-wide text-sage-dark">you</span>}
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-sm font-bold tabular-nums text-sage-dark">
                  {r.score}
                  <span className="text-ink3">/{LADDER_LEN}</span>
                </span>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
