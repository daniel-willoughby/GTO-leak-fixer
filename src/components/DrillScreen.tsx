import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Flame, ArrowRight } from 'lucide-react'
import {
  ACTION_LABEL,
  generateSpot,
  judge,
  type Action,
  type DrillMode,
  type Judgement,
  type Spot,
} from '../lib/spot'
import { isRfiHand, type RfiPosition } from '../data/ranges'
import { MATCHUPS, respond } from '../data/vsRfi'
import { strategyFor } from '../data/postflop'
import { logDecision } from '../lib/db'
import { playCorrect, playWrong, playDeal, playStreak } from '../lib/sound'
import PokerTable from './PokerTable'
import RangeGrid, { type CellKind } from './RangeGrid'

interface Props {
  onProgress: () => void
}

const ACTION_STYLE: Record<Action, string> = {
  fold: 'btn btn-slate',
  call: 'btn btn-sky',
  raise: 'btn btn-emerald',
  '3bet': 'btn btn-emerald',
  check: 'btn btn-slate',
  bet: 'btn btn-emerald',
}

const KEY_HINT: Record<Action, string> = { fold: 'F', call: 'C', raise: 'R', '3bet': 'T', check: 'K', bet: 'B' }

const MODES: { id: DrillMode; label: string }[] = [
  { id: 'rfi', label: 'Open' },
  { id: 'vsRfi', label: 'Facing raise' },
  { id: 'postflop', label: 'Postflop' },
]

function cellFor(spot: Spot): (label: string) => CellKind {
  if (spot.mode === 'rfi') {
    const pos = spot.heroPos as RfiPosition
    return (label) => (isRfiHand(pos, label) ? 'raise' : 'fold')
  }
  if (spot.mode === 'postflop') {
    const node = spot.node!
    return (label) => {
      const s = strategyFor(node, label)
      return s && s.primary.startsWith('bet') ? 'raise' : 'fold'
    }
  }
  const m = MATCHUPS.find((x) => x.raiser === spot.raiserPos && x.hero === spot.heroPos)!
  return (label) => {
    const a = respond(m, label)
    return a === '3bet' ? 'raise' : a === 'call' ? 'call' : 'fold'
  }
}

export default function DrillScreen({ onProgress }: Props) {
  const [mode, setMode] = useState<DrillMode>('rfi')
  const [spot, setSpot] = useState<Spot>(() => generateSpot('rfi'))
  const [result, setResult] = useState<Judgement | null>(null)
  const [streak, setStreak] = useState(0)

  function next(m: DrillMode = mode) {
    setSpot(generateSpot(m))
    setResult(null)
    playDeal()
  }

  function switchMode(m: DrillMode) {
    if (m === mode) return
    setMode(m)
    setStreak(0)
    next(m)
  }

  async function answer(action: Action) {
    if (result || !spot.actions.includes(action)) return
    const j = judge(spot, action)
    setResult(j)
    if (j.isCorrect) {
      setStreak((s) => {
        const ns = s + 1
        if (ns > 0 && ns % 5 === 0) playStreak()
        else playCorrect()
        return ns
      })
    } else {
      setStreak(0)
      playWrong()
    }
    await logDecision({
      ts: Date.now(),
      mode: spot.mode,
      context: spot.mode === 'postflop' ? spot.node!.board : spot.heroPos,
      position: spot.heroPos,
      label: spot.label,
      category: spot.category,
      chosen: j.chosen,
      correct: j.correct,
      isCorrect: j.isCorrect,
    })
    onProgress()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase()
      if (result) {
        if (e.key === ' ' || e.key === 'Enter') next()
        return
      }
      if (k === 'f') answer('fold')
      else if (k === 'r') answer('raise')
      else if (k === 'c') answer('call')
      else if (k === 't') answer('3bet')
      else if (k === 'k') answer('check')
      else if (k === 'b') answer('bet')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const prompt =
    spot.mode === 'rfi'
      ? 'Folded to you. Open-raise or fold?'
      : spot.mode === 'vsRfi'
        ? `${spot.raiserPos} raises. Fold, call, or 3-bet?`
        : 'BB checks. Bet or check back?'

  return (
    <div className="flex flex-col items-center gap-4 px-4 pb-28 pt-4 max-w-xl mx-auto">
      {/* mode toggle */}
      <div className="flex gap-1 p-1 rounded-2xl bg-slate-800/60 border border-white/10 backdrop-blur-sm text-sm w-full max-w-sm">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={`flex-1 px-2 py-2 rounded-xl font-semibold transition ${
              mode === m.id
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-[0_4px_14px_-3px_rgba(245,196,81,0.55)]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between w-full text-sm">
        <span className="text-slate-400">
          {spot.mode === 'postflop' ? 'BTN vs BB · single-raised pot' : '100bb · 6-max cash'}
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border transition ${
            streak >= 3
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              : 'border-white/10 bg-white/[0.03] text-slate-400'
          }`}
        >
          <Flame size={15} className={streak >= 3 ? 'text-amber-400' : 'text-slate-500'} />
          <span className="font-bold tabular-nums">{streak}</span>
        </span>
      </div>

      <PokerTable
        heroPos={spot.heroPos}
        heroCards={spot.cards}
        raiserPos={spot.raiserPos}
        board={spot.board}
        villain={spot.mode === 'postflop' ? { pos: 'BB', note: 'checks' } : undefined}
      />

      <p className="text-slate-100 text-[15px] text-center font-medium">{prompt}</p>

      {!result ? (
        <div className={`grid gap-3 w-full max-w-sm ${spot.actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {spot.actions.map((a) => (
            <button key={a} onClick={() => answer(a)} className={`py-4 text-lg ${ACTION_STYLE[a]}`}>
              {ACTION_LABEL[a]} <span className="text-xs opacity-70">({KEY_HINT[a]})</span>
            </button>
          ))}
        </div>
      ) : (
        /* Extra bottom padding so the range grid clears the sticky Next button */
        <div className="w-full flex flex-col items-center gap-4 animate-pop pb-24">
          <div
            className={`w-full rounded-2xl p-4 text-sm leading-relaxed flex gap-3 backdrop-blur-md border ${
              result.isCorrect
                ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_30px_-12px_rgba(16,185,129,0.5)]'
                : 'bg-red-500/10 border-red-500/40 shadow-[0_0_30px_-12px_rgba(239,68,68,0.5)]'
            }`}
          >
            {result.isCorrect ? (
              <CheckCircle2 size={22} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={22} className="text-red-400 shrink-0 mt-0.5" />
            )}
            <span>{result.explanation}</span>
          </div>
          <div className="w-full">
            <p className="text-xs text-slate-400 mb-2 text-center">
              {spot.mode === 'rfi' && `${spot.heroPos} opening range — `}
              {spot.mode === 'vsRfi' && `${spot.heroPos} vs ${spot.raiserPos} — `}
              {spot.mode === 'postflop' && `${spot.node?.board} c-bet (majority action) — `}
              <span className="text-emerald-400">
                green = {spot.mode === 'rfi' ? 'raise' : spot.mode === 'vsRfi' ? '3bet' : 'bet'}
              </span>
              {spot.mode === 'vsRfi' && <span className="text-sky-400">, blue = call</span>}
              , amber ring = your hand
            </p>
            <RangeGrid cell={cellFor(spot)} highlight={spot.label} />
          </div>
        </div>
      )}

      {/* Next hand — always visible, pinned above the nav bar */}
      {result && (
        <div className="fixed bottom-0 inset-x-0 z-20 flex justify-center px-4 pb-[calc(4.25rem+env(safe-area-inset-bottom))] pt-10 bg-gradient-to-t from-[#090d18] via-[#090d18]/90 to-transparent pointer-events-none">
          <button
            onClick={() => next()}
            className="btn btn-gold pointer-events-auto w-full max-w-sm py-4 text-lg flex items-center justify-center gap-2"
          >
            Next hand <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
