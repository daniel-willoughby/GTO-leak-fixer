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
  fold: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-600',
  call: 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700',
  raise: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
  '3bet': 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
  check: 'bg-slate-700 hover:bg-slate-600 active:bg-slate-600',
  bet: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
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
      <div className="flex gap-1 p-1 rounded-xl bg-slate-800 text-sm w-full max-w-sm">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={`flex-1 px-2 py-2 rounded-lg font-semibold transition ${
              mode === m.id ? 'bg-amber-500 text-slate-900' : 'text-slate-300 hover:text-white'
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
        <span className="flex items-center gap-1.5 text-slate-400">
          <Flame size={16} className={streak >= 3 ? 'text-amber-400' : 'text-slate-500'} />
          <span className={`font-bold tabular-nums ${streak >= 3 ? 'text-amber-400' : 'text-slate-300'}`}>{streak}</span>
        </span>
      </div>

      <PokerTable
        heroPos={spot.heroPos}
        heroCards={spot.cards}
        raiserPos={spot.raiserPos}
        board={spot.board}
        villain={spot.mode === 'postflop' ? { pos: 'BB', note: 'checks' } : undefined}
      />

      <p className="text-slate-200 text-sm text-center font-medium">{prompt}</p>

      {!result ? (
        <div className={`grid gap-3 w-full max-w-sm ${spot.actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {spot.actions.map((a) => (
            <button
              key={a}
              onClick={() => answer(a)}
              className={`py-4 rounded-xl font-bold text-lg transition active:scale-[0.97] ${ACTION_STYLE[a]}`}
            >
              {ACTION_LABEL[a]} <span className="text-xs opacity-70">({KEY_HINT[a]})</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-4 animate-pop">
          <div
            className={`w-full rounded-xl p-4 text-sm leading-relaxed flex gap-3 ${
              result.isCorrect
                ? 'bg-emerald-900/40 border border-emerald-600/50'
                : 'bg-red-900/40 border border-red-600/50'
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
          <button
            onClick={() => next()}
            className="w-full max-w-sm py-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-900 font-bold text-lg transition flex items-center justify-center gap-2"
          >
            Next hand <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
