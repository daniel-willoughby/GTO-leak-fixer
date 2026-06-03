import { useEffect, useState, type ReactNode } from 'react'
import { Target, RotateCcw, Layers, Spade } from 'lucide-react'
import { getLeakSummary, resetProgress, type LeakStat, type LeakSummary, type ModeStats } from '../lib/db'

interface Props {
  version: number // bump to force refresh
}

function Bar({ stat }: { stat: LeakStat }) {
  const pct = Math.round(stat.errorRate * 100)
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 sm:w-40 truncate text-slate-300">{stat.key}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={pct > 33 ? 'h-full bg-red-500' : pct > 15 ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 text-right text-slate-400 tabular-nums">
        {pct}% · {stat.errors}/{stat.attempts}
      </span>
    </div>
  )
}

function ModeSection({
  title,
  icon,
  contextLabel,
  stats,
}: {
  title: string
  icon: ReactNode
  contextLabel: string
  stats: ModeStats
}) {
  if (stats.total === 0) return null
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <span className="text-sm text-slate-400">
          <span className="text-amber-400 font-bold">{Math.round(stats.accuracy * 100)}%</span> · {stats.total} hands
        </span>
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">By {contextLabel}</p>
      <div className="flex flex-col gap-2 mb-4">
        {stats.byContext.map((s) => (
          <Bar key={s.key} stat={s} />
        ))}
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">By hand type</p>
      <div className="flex flex-col gap-2">
        {stats.byCategory.map((s) => (
          <Bar key={s.key} stat={s} />
        ))}
      </div>
    </section>
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
        <p className="text-lg mb-2 text-slate-200">No hands yet.</p>
        <p>Play some drills and your top leaks will show up here — the spots you misplay most.</p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-4xl font-extrabold gold-text">{Math.round(sum.accuracy * 100)}%</div>
          <div className="text-slate-400 text-sm">
            {sum.total} hands · {sum.correct} correct
          </div>
        </div>
        <button
          onClick={async () => {
            await resetProgress()
            setSum(await getLeakSummary())
          }}
          className="text-xs px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center gap-1.5"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Target size={20} className="text-red-400" /> Your top leaks
        </h2>
        {sum.topLeaks.length === 0 ? (
          <p className="text-slate-400 text-sm">
            No clear leaks yet — keep playing (need 4+ hands per group to flag one). Nice and tight!
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

      <ModeSection
        title="Preflop"
        icon={<Layers size={18} className="text-sky-400" />}
        contextLabel="position"
        stats={sum.preflop}
      />
      <ModeSection
        title="Postflop"
        icon={<Spade size={18} className="text-emerald-400" />}
        contextLabel="board"
        stats={sum.postflop}
      />
    </div>
  )
}
