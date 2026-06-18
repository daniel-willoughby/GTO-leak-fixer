import { Trophy, ArrowRight, RotateCcw } from 'lucide-react'
import { DAILY_COMPLETE_BONUS, PP_PER_CORRECT } from '../lib/points'

interface Props {
  score: number
  total: number
  onClose: () => void
  onLeaderboard: () => void
}

/** Shown after finishing the daily ladder: score, PP earned, next steps. */
export default function LadderResults({ score, total, onClose, onLeaderboard }: Props) {
  const pp = score * PP_PER_CORRECT + DAILY_COMPLETE_BONUS
  const pct = Math.round((score / total) * 100)
  const blurb =
    pct >= 90 ? 'Outstanding — you crushed it.' : pct >= 70 ? 'Strong run.' : pct >= 50 ? 'Solid effort.' : 'Keep grinding — tomorrow’s a new board.'

  return (
    <div className="px-4 pt-10 pb-28 max-w-md mx-auto flex flex-col items-center gap-5 text-center animate-pop">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-clay/15 text-clay animate-spring">
        <Trophy size={32} />
      </span>
      <div>
        <h1 className="serif text-2xl text-ink">Daily challenge complete</h1>
        <p className="mt-1 text-sm text-ink2">{blurb}</p>
      </div>

      <div className="flex w-full items-stretch gap-3">
        <div className="flex-1 rounded-2xl border border-line bg-paper2 p-4">
          <div className="serif text-3xl font-semibold text-sage-dark">
            {score}
            <span className="text-lg text-ink3">/{total}</span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink3">Correct</p>
        </div>
        <div className="flex-1 rounded-2xl border border-clay/30 bg-clay/[0.07] p-4">
          <div className="serif text-3xl font-semibold text-clay">+{pp}</div>
          <p className="mt-1 text-xs uppercase tracking-wide text-ink3">Poker Points</p>
        </div>
      </div>

      <button onClick={onLeaderboard} className="btn btn-primary flex w-full items-center justify-center gap-2 py-3.5 text-base">
        <Trophy size={16} /> View leaderboard <ArrowRight size={16} />
      </button>
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-ink2 hover:text-ink">
        <RotateCcw size={14} /> Back to drilling
      </button>
    </div>
  )
}
