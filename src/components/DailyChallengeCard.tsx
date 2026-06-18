import { CalendarCheck, Flame, Play, RotateCcw, Check } from 'lucide-react'
import { dailyResult } from '../lib/points'
import { ladderProgress, LADDER_LEN } from '../lib/dailyLadder'
import { getDaily, liveStreak } from '../lib/daily'

interface Props {
  /** UTC day key. */
  day: string
  /** Bump to re-read status after a run. */
  version: number
  onPlay: () => void
}

/** The daily-ladder launcher shown atop the Drill tab. */
export default function DailyChallengeCard({ day, version, onPlay }: Props) {
  // version participates so the card re-reads localStorage after a run
  void version
  const done = dailyResult(day)
  const progress = ladderProgress(day)
  const streak = liveStreak(getDaily())

  const state = done?.completed ? 'done' : progress ? 'resume' : 'new'
  const label = state === 'done' ? 'Play again' : state === 'resume' ? 'Resume' : 'Play'
  const Icon = state === 'done' ? RotateCcw : Play

  return (
    <div className="mx-auto mb-3 flex w-full max-w-xl items-center gap-3 rounded-2xl border border-clay/30 bg-clay/[0.07] p-3.5 lg:max-w-2xl">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-clay/15 text-clay">
        <CalendarCheck size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="serif text-[15px] leading-tight text-ink">Daily challenge</p>
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-xs font-bold text-clay">
              <Flame size={12} /> {streak}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink2">
          {state === 'done' ? (
            <span className="inline-flex items-center gap-1 text-sage-dark">
              <Check size={12} /> Today: {done!.score}/{LADDER_LEN}
            </span>
          ) : state === 'resume' ? (
            `Resume · ${progress!.index}/${LADDER_LEN} answered`
          ) : (
            `${LADDER_LEN} spots, easy opens to tricky postflop`
          )}
        </p>
      </div>
      <button
        onClick={onPlay}
        className="btn btn-primary flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm"
      >
        <Icon size={15} /> {label}
      </button>
    </div>
  )
}
