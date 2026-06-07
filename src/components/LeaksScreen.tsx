import { useEffect, useState, type ReactNode } from 'react'
import { Target, RotateCcw, Layers, Spade, TrendingUp, TrendingDown, LineChart } from 'lucide-react'
import {
  getLeakSummary,
  progressTrend,
  resetProgress,
  type LeakStat,
  type LeakSummary,
  type ModeStats,
  type ProgressTrend,
} from '../lib/db'

interface Props {
  version: number // bump to force refresh
}

function ProgressChart({ trend }: { trend: ProgressTrend }) {
  const up = trend.delta >= 0.02
  const down = trend.delta <= -0.02
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <LineChart size={18} className="text-sage" /> Progress
        </h2>
        <span className={`flex items-center gap-1 text-sm font-semibold ${up ? 'text-sage' : down ? 'text-heartred' : 'text-ink2'}`}>
          {up ? <TrendingUp size={15} /> : down ? <TrendingDown size={15} /> : null}
          {trend.delta >= 0 ? '+' : ''}
          {Math.round(trend.delta * 100)}%
        </span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {trend.buckets.map((b, i) => {
          const pct = Math.round(b.accuracy * 100)
          const color = pct >= 80 ? 'bg-sage' : pct >= 55 ? 'bg-[#c79a4a]' : 'bg-clay'
          return (
            <div
              key={i}
              className={`flex-1 rounded-t ${color} transition-all`}
              style={{ height: `${Math.max(6, b.accuracy * 100)}%` }}
              title={`${pct}% (${b.count} hands)`}
            />
          )
        })}
      </div>
      <p className="text-xs text-ink3 mt-2 text-center">accuracy per session, oldest → newest</p>
    </section>
  )
}

function Bar({ stat }: { stat: LeakStat }) {
  const pct = Math.round(stat.errorRate * 100)
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 sm:w-40 truncate text-ink">{stat.key}</span>
      <div className="flex-1 h-2 rounded-full bg-[#e9e3d6] overflow-hidden">
        <div
          className={pct > 33 ? 'h-full bg-clay' : pct > 15 ? 'h-full bg-[#c79a4a]' : 'h-full bg-sage'}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 text-right text-ink2 tabular-nums">
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
        <span className="text-sm text-ink2">
          <span className="text-sage-dark font-bold">{Math.round(stats.accuracy * 100)}%</span> · {stats.total} hands
        </span>
      </div>
      <p className="text-xs uppercase tracking-wide text-ink3 mb-2">By {contextLabel}</p>
      <div className="flex flex-col gap-2 mb-4">
        {stats.byContext.map((s) => (
          <Bar key={s.key} stat={s} />
        ))}
      </div>
      <p className="text-xs uppercase tracking-wide text-ink3 mb-2">By hand type</p>
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
  const [trend, setTrend] = useState<ProgressTrend | null>(null)

  useEffect(() => {
    getLeakSummary().then(setSum)
    progressTrend().then(setTrend)
  }, [version])

  if (!sum) return <div className="p-8 text-center text-ink2">Loading…</div>

  if (sum.total === 0) {
    return (
      <div className="p-8 text-center text-ink2 max-w-md mx-auto pt-16">
        <p className="serif text-2xl mb-2 text-ink">No hands yet.</p>
        <p>Play some drills and your top leaks will show up here: the spots you misplay most.</p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="serif text-5xl font-semibold text-sage-dark">{Math.round(sum.accuracy * 100)}%</div>
          <div className="text-ink2 text-sm mt-1">
            {sum.total} hands · {sum.correct} correct
          </div>
        </div>
        <button
          onClick={async () => {
            await resetProgress()
            setSum(await getLeakSummary())
          }}
          className="text-xs px-3 py-2 rounded-lg bg-paper2 border border-line text-ink2 hover:text-ink flex items-center gap-1.5"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {trend && <ProgressChart trend={trend} />}

      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Target size={20} className="text-clay" /> Your top leaks
        </h2>
        {sum.topLeaks.length === 0 ? (
          <p className="text-ink2 text-sm">
            No clear leaks yet. Keep playing (need 4+ hands per group to flag one). Nice and tight!
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {sum.topLeaks.map((l) => (
              <div key={l.key} className="rounded-xl bg-clay/10 border border-clay/30 p-3">
                <div className="font-semibold text-clay">{l.key}</div>
                <div className="text-sm text-ink2">
                  Wrong {Math.round(l.errorRate * 100)}% of the time ({l.errors} of {l.attempts}). Drill this.
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ModeSection
        title="Preflop"
        icon={<Layers size={18} className="text-dblue" />}
        contextLabel="position"
        stats={sum.preflop}
      />
      <ModeSection title="Postflop" icon={<Spade size={18} className="text-sage" />} contextLabel="board" stats={sum.postflop} />
    </div>
  )
}
