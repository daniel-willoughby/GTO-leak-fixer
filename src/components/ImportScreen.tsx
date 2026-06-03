import { useState } from 'react'
import { FileText, Zap, AlertCircle } from 'lucide-react'
import { parseHandHistory, type ImportReport, type LeakBar } from '../lib/hhParser'
import type { HandCategory } from '../lib/spot'

interface Props {
  onDrillLeaks: (cats: HandCategory[]) => void
}

const SAMPLE = `PokerStars Hand #1: Hold'em No Limit ($0.05/$0.10) - 2024/01/01 12:00:00 ET
Table 'Sample' 6-max Seat #1 is the button
Seat 1: Hero ($10 in chips)
Seat 2: P2 ($10 in chips)
Seat 3: P3 ($10 in chips)
Seat 4: P4 ($10 in chips)
Seat 5: P5 ($10 in chips)
Seat 6: P6 ($10 in chips)
P2: posts small blind $0.05
P3: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [Kh Qs]
P4: folds
P5: folds
P6: folds
Hero: raises $0.20 to $0.30
P2: folds
P3: folds

PokerStars Hand #2: Hold'em No Limit ($0.05/$0.10) - 2024/01/01 12:01:00 ET
Table 'Sample' 6-max Seat #3 is the button
Seat 1: Hero ($10 in chips)
Seat 2: P2 ($10 in chips)
Seat 3: P3 ($10 in chips)
Seat 4: P4 ($10 in chips)
Seat 5: P5 ($10 in chips)
Seat 6: P6 ($10 in chips)
P4: posts small blind $0.05
P5: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [7c 2d]
P6: folds
Hero: raises $0.20 to $0.30
P2: folds

PokerStars Hand #3: Hold'em No Limit ($0.05/$0.10) - 2024/01/01 12:02:00 ET
Table 'Sample' 6-max Seat #5 is the button
Seat 1: Hero ($10 in chips)
Seat 2: P2 ($10 in chips)
Seat 3: P3 ($10 in chips)
Seat 4: P4 ($10 in chips)
Seat 5: P5 ($10 in chips)
Seat 6: P6 ($10 in chips)
P6: posts small blind $0.05
P1: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [Ad Jc]
P2: raises $0.20 to $0.30
P3: folds
P4: folds
P5: folds
P6: folds
Hero: folds
`

function Bar({ stat }: { stat: LeakBar }) {
  const pct = Math.round(stat.errorRate * 100)
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 truncate text-slate-300">{stat.key}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
        <div className={pct > 33 ? 'h-full bg-red-500' : pct > 15 ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right text-slate-400 tabular-nums">{pct}% · {stat.errors}/{stat.attempts}</span>
    </div>
  )
}

export default function ImportScreen({ onDrillLeaks }: Props) {
  const [text, setText] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)

  function analyze(input: string) {
    setReport(parseHandHistory(input))
  }

  return (
    <div className="px-4 pb-28 pt-6 max-w-xl mx-auto flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText size={20} className="text-sky-400" /> Import your hands
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Paste PokerStars 6-max hand histories. We grade your preflop decisions against GTO and surface your real leaks.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste hand history text here…"
        spellCheck={false}
        className="w-full h-40 rounded-xl bg-slate-900/60 border border-white/10 p-3 text-xs font-mono text-slate-200 resize-none focus:outline-none focus:border-sky-500/50"
      />

      <div className="flex gap-2">
        <button
          onClick={() => analyze(text)}
          disabled={!text.trim()}
          className="btn btn-sky flex-1 py-3 text-base disabled:opacity-40"
        >
          Analyze
        </button>
        <button
          onClick={() => { setText(SAMPLE); analyze(SAMPLE) }}
          className="btn btn-slate px-4 py-3 text-sm"
        >
          Try sample
        </button>
      </div>

      {report && (
        <div className="flex flex-col gap-5 animate-pop">
          {report.graded === 0 ? (
            <div className="panel p-4 flex gap-3 text-sm text-slate-300">
              <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-100 mb-1">No gradeable hands found.</p>
                <p>
                  Found {report.handsFound} hand(s) but none were 6-handed preflop spots we can grade yet (RFI or facing
                  a single raise). 3-bet pots, multiway pots, and non-6-max tables aren't graded.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="panel p-4 flex items-center justify-between">
                <div>
                  <div className="text-4xl font-extrabold gold-text">{Math.round(report.accuracy * 100)}%</div>
                  <div className="text-slate-400 text-sm">{report.graded} graded · {report.correct} correct</div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {report.handsFound} hands found<br />
                  {report.ungraded} not graded
                </div>
              </div>

              {report.byPosition.length > 0 && (
                <section className="panel p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">By position</p>
                  <div className="flex flex-col gap-2">{report.byPosition.map((s) => <Bar key={s.key} stat={s} />)}</div>
                </section>
              )}

              {report.byCategory.length > 0 && (
                <section className="panel p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">By hand type</p>
                  <div className="flex flex-col gap-2">{report.byCategory.map((s) => <Bar key={s.key} stat={s} />)}</div>
                </section>
              )}

              {report.decisions.some((d) => !d.isCorrect) && (
                <section>
                  <h3 className="text-sm font-semibold mb-2 text-red-200">Misplayed hands</h3>
                  <div className="flex flex-col gap-1.5">
                    {report.decisions.filter((d) => !d.isCorrect).slice(0, 8).map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-red-900/20 border border-red-700/30 px-3 py-1.5">
                        <span className="text-slate-200 font-semibold">{d.label}</span>
                        <span className="text-slate-400 text-xs">
                          {d.heroPos}{d.raiserPos ? ` vs ${d.raiserPos}` : ''}: you {d.heroAction}, GTO {d.correctAction}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {report.weakCategories.length > 0 && (
                <button onClick={() => onDrillLeaks(report.weakCategories)} className="btn btn-gold w-full py-4 text-base flex items-center justify-center gap-2">
                  <Zap size={18} /> Drill these leaks
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
