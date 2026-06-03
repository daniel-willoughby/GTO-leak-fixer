import { useEffect, useState } from 'react'
import { getLeakSummary, resetProgress, type LeakStat, type LeakSummary } from '../lib/db'

interface Props {
  version: number // bump to force refresh
}

function Bar({ stat }: { stat: LeakStat }) {
  const pct = Math.round(stat.errorRate * 100)
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-40 truncate text-slate-300">{stat.key}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={pct > 33 ? 'h-full bg-red-500' : pct > 15 ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-24 text-right text-slate-400 tabular-nums">
        {pct}% · {stat.errors}/{stat.attempts}
      </span>
    </div>
  )
}

export default function LeaksScreen({ version }: Props) {
  const [sum, setSum] = useState<LeakSummary | null>(null)

  useEffect(() => {
    getLeakSummary().then(setSum)
  }, [version])

  if (!sum) return <div className="p-8 text-center text-slate-400">Loading…</div>

  if (sum.total === 0) {
    return (
      <div className="p-8 text-center text-slate-400 max-w-md mx-auto pt-16">
        <p className="text-lg mb-2">No hands yet.</p>
        <p>Play some drills and your top leaks will show up here — the spots you misplay most.</p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-amber-400">{Math.round(sum.accuracy * 100)}%</div>
          <div className="text-slate-400 text-sm">{sum.total} hands · {sum.correct} correct</div>
        </div>
        <button
          onClick={async () => {
            await resetProgress()
            setSum(await getLeakSummary())
          }}
          className="text-xs px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600"
        >
          Reset
        </button>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3">🎯 Your top leaks</h2>
        {sum.topLeaks.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No clear leaks yet — keep playing (need 4+ hands per category to flag one). Nice and tight!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {sum.topLeaks.map((l) => (
              <div key={l.key} className="rounded-xl bg-red-900/30 border border-red-700/40 p-3">
                <div className="font-semibold text-red-200">{l.key}</div>
                <div className="text-sm text-slate-300">
                  Wrong {Math.round(l.errorRate * 100)}% of the time ({l.errors} of {l.attempts}). Drill this.
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">By position</h2>
        <div className="flex flex-col gap-2">
          {sum.byPosition.map((s) => (
            <Bar key={s.key} stat={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">By hand type</h2>
        <div className="flex flex-col gap-2">
          {sum.byCategory.map((s) => (
            <Bar key={s.key} stat={s} />
          ))}
        </div>
      </section>
    </div>
  )
}
