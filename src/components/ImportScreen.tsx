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
      <span className="w-36 truncate text-ink">{stat.key}</span>
      <div className="flex-1 h-2 rounded-full bg-[#e9e3d6] overflow-hidden">
        <div className={pct > 33 ? 'h-full bg-clay' : pct > 15 ? 'h-full bg-[#c79a4a]' : 'h-full bg-sage'} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right text-ink2 tabular-nums">{pct}% · {stat.errors}/{stat.attempts}</span>
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
    <div className="px-4 pb-28 pt-6 max-w-xl lg:max-w-3xl mx-auto flex flex-col gap-5">
      <div>
        <h2 className="serif text-xl flex items-center gap-2">
          <FileText size={20} className="text-dblue" /> Import your hands
        </h2>
        <p className="text-sm text-ink2 mt-1">
          Paste PokerStars 6-max hand histories. We grade your preflop decisions against GTO and surface your real leaks.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste hand history text here…"
        spellCheck={false}
        className="w-full h-40 rounded-xl bg-paper2 border border-line p-3 text-xs font-mono text-ink resize-none focus:outline-none focus:border-sage"
      />

      <div className="flex gap-2">
        <button onClick={() => analyze(text)} disabled={!text.trim()} className="btn btn-sky flex-1 py-3 text-base disabled:opacity-40">
          Analyze
        </button>
        <button onClick={() => { setText(SAMPLE); analyze(SAMPLE) }} className="btn btn-secondary px-4 py-3 text-sm">
          Try sample
        </button>
      </div>

      {report && (
        <div className="flex flex-col gap-5 animate-pop">
          {report.graded === 0 ? (
            <div className="panel p-4 flex gap-3 text-sm text-ink2">
              <AlertCircle size={20} className="text-[#b88a3a] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink mb-1">No gradeable hands found.</p>
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
                  <div className="serif text-5xl font-semibold text-sage-dark">{Math.round(report.accuracy * 100)}%</div>
                  <div className="text-ink2 text-sm mt-1">{report.graded} graded · {report.correct} correct</div>
                </div>
                <div className="text-right text-xs text-ink3">
                  {report.handsFound} hands found<br />
                  {report.ungraded} not graded
                </div>
              </div>

              {report.byPosition.length > 0 && (
                <section className="panel p-4">
                  <p className="text-xs uppercase tracking-wide text-ink3 mb-2">By position</p>
                  <div className="flex flex-col gap-2">{report.byPosition.map((s) => <Bar key={s.key} stat={s} />)}</div>
                </section>
              )}

              {report.byCategory.length > 0 && (
                <section className="panel p-4">
                  <p className="text-xs uppercase tracking-wide text-ink3 mb-2">By hand type</p>
                  <div className="flex flex-col gap-2">{report.byCategory.map((s) => <Bar key={s.key} stat={s} />)}</div>
                </section>
              )}

              {report.decisions.some((d) => !d.isCorrect) && (
                <section>
                  <h3 className="text-sm font-semibold mb-2 text-clay">Misplayed hands</h3>
                  <div className="flex flex-col gap-1.5">
                    {report.decisions.filter((d) => !d.isCorrect).slice(0, 8).map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-clay/10 border border-clay/25 px-3 py-1.5">
                        <span className="text-ink font-semibold">{d.label}</span>
                        <span className="text-ink2 text-xs">
                          {d.heroPos}{d.raiserPos ? ` vs ${d.raiserPos}` : ''}: you {d.heroAction}, GTO {d.correctAction}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {report.weakCategories.length > 0 && (
                <button onClick={() => onDrillLeaks(report.weakCategories)} className="btn btn-primary w-full py-4 text-base flex items-center justify-center gap-2">
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
