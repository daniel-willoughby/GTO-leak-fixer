import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, MinusCircle, Flame, ArrowRight, FastForward, Zap, Repeat2, X } from 'lucide-react'
import {
  ACTION_LABEL,
  buildContinuationSpot,
  generateSpot,
  judge,
  seedKey,
  seedOf,
  spotFromSeed,
  type Action,
  type Difficulty,
  type DrillMode,
  type HandCategory,
  type Judgement,
  type Spot,
} from '../lib/spot'
import { isRfiHand, type RfiPosition } from '../data/ranges'
import { MATCHUPS, respond } from '../data/vsRfi'
import { MULTIWAY_MATCHUPS, respondMultiway } from '../data/multiway'
import { strategyFor } from '../data/postflop'
import {
  dueMistakes,
  enqueueMistake,
  logDecision,
  mistakeCount,
  retireMistake,
  touchMistake,
  weakCategories,
  type MistakeRecord,
} from '../lib/db'
import { playCorrect, playWrong, playDeal, playStreak } from '../lib/sound'
import PokerTable from './PokerTable'
import RangeGrid, { type CellKind } from './RangeGrid'
import HandHistory from './HandHistory'

interface Props {
  onProgress: () => void
  /** Categories to focus drilling on (from a hand-history import) */
  requestFocus?: HandCategory[] | null
  onFocusConsumed?: () => void
  difficulty?: Difficulty
}

const ACTION_STYLE: Record<Action, string> = {
  fold: 'btn btn-secondary',
  call: 'btn btn-sky',
  raise: 'btn btn-primary',
  '3bet': 'btn btn-primary',
  check: 'btn btn-secondary',
  bet: 'btn btn-primary',
  squeeze: 'btn btn-primary',
  'cold-4bet': 'btn btn-primary',
}

const KEY_HINT: Record<string, string> = { fold: 'F', call: 'C', raise: 'R', '3bet': 'T', check: 'K', bet: 'B', squeeze: 'S', 'cold-4bet': '4' }

const MODES: { id: DrillMode; label: string }[] = [
  { id: 'rfi', label: 'Open' },
  { id: 'vsRfi', label: 'vs Raise' },
  { id: 'multiway', label: 'Multiway' },
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
  if (spot.mode === 'multiway') {
    const m = MULTIWAY_MATCHUPS.find((x) => x.hero === spot.heroPos)!
    if (!m) return () => 'fold'
    return (label) => {
      const a = respondMultiway(m, label)
      return a === 'squeeze' || a === 'cold-4bet' ? 'raise' : a === 'call' ? 'call' : 'fold'
    }
  }
  const m = MATCHUPS.find((x) => x.raiser === spot.raiserPos && x.hero === spot.heroPos)!
  return (label) => {
    const a = respond(m, label)
    return a === '3bet' ? 'raise' : a === 'call' ? 'call' : 'fold'
  }
}

export default function DrillScreen({ onProgress, requestFocus, onFocusConsumed, difficulty = 'all' }: Props) {
  const [mode, setMode] = useState<DrillMode>('rfi')
  const [spot, setSpot] = useState<Spot>(() => generateSpot('rfi'))
  const [result, setResult] = useState<Judgement | null>(null)
  const [streak, setStreak] = useState(0)
  const [canContinue, setCanContinue] = useState(false)
  // adaptive focus
  const [focusOn, setFocusOn] = useState(false)
  const [focusCats, setFocusCats] = useState<Set<HandCategory>>(new Set())
  // review queue (spaced repetition)
  const [reviewQueue, setReviewQueue] = useState<MistakeRecord[]>([])
  const [reviewMode, setReviewMode] = useState(false)
  const [mistakeBadge, setMistakeBadge] = useState(0)

  // load weak categories + mistake count once
  useEffect(() => {
    weakCategories().then((cats) => setFocusCats(new Set(cats)))
    mistakeCount().then(setMistakeBadge)
  }, [])

  // re-deal when difficulty changes (unless mid-feedback or reviewing)
  useEffect(() => {
    if (!reviewMode && !result) setSpot(generateSpot(mode, { focus: focusOn ? focusCats : undefined, difficulty }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty])

  // focus request from import
  useEffect(() => {
    if (requestFocus && requestFocus.length) {
      setFocusCats(new Set(requestFocus))
      setFocusOn(true)
      if (mode === 'postflop') setMode('rfi')
      setSpot(generateSpot(mode === 'postflop' ? 'rfi' : mode, { focus: new Set(requestFocus) }))
      setResult(null)
      onFocusConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestFocus])

  function dealNormal(m: DrillMode = mode) {
    setSpot(generateSpot(m, { focus: focusOn ? focusCats : undefined, difficulty }))
    setResult(null)
    setCanContinue(false)
    playDeal()
  }

  function dealReview(queue: MistakeRecord[]) {
    // find the first seed that still produces a valid spot
    for (let i = 0; i < queue.length; i++) {
      const s = spotFromSeed(queue[i].seed)
      if (s) {
        if (i > 0) queue = [...queue.slice(i), ...queue.slice(0, i)]
        setReviewQueue(queue)
        setSpot(s)
        setResult(null)
        setCanContinue(false)
        playDeal()
        return
      }
    }
    // nothing valid left → exit review
    exitReview()
  }

  function next() {
    if (reviewMode) {
      if (reviewQueue.length === 0) return exitReview()
      dealReview(reviewQueue)
    } else {
      dealNormal()
    }
  }

  function switchMode(m: DrillMode) {
    if (m === mode || reviewMode) return
    setMode(m)
    setStreak(0)
    dealNormal(m)
  }

  function toggleFocus() {
    const on = !focusOn
    setFocusOn(on)
    if (on) weakCategories().then((cats) => setFocusCats(new Set(cats)))
  }

  async function startReview() {
    const q = await dueMistakes()
    if (!q.length) return
    setReviewMode(true)
    setStreak(0)
    dealReview(q)
  }

  function exitReview() {
    setReviewMode(false)
    dealNormal(mode)
  }

  function continueHand() {
    if (!spot.handState || !result) return
    const continuation = buildContinuationSpot(spot.handState, result.chosen)
    if (!continuation) return next()
    setSpot(continuation)
    setResult(null)
    setCanContinue(false)
    playDeal()
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
    if (spot.mode === 'postflop' && spot.handState?.street === 'flop' && !reviewMode) {
      setCanContinue(!!buildContinuationSpot(spot.handState, action))
    }

    const key = seedKey(seedOf(spot))
    if (reviewMode) {
      if (j.isCorrect) {
        await retireMistake(key)
        setReviewQueue((q) => q.filter((m) => m.key !== key))
      } else {
        await touchMistake(key)
        // move the current spot to the back of the queue
        setReviewQueue((q) => [...q.filter((m) => m.key !== key), ...q.filter((m) => m.key === key)])
      }
      mistakeCount().then(setMistakeBadge)
    } else if (!j.isCorrect) {
      await enqueueMistake(key, seedOf(spot))
      mistakeCount().then(setMistakeBadge)
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
      else if (k === 's') answer('squeeze')
      else if (k === '4') answer('cold-4bet')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const history = spot.handState?.history ?? []
  const street = spot.handState?.street
  const prompt =
    spot.mode === 'rfi'
      ? 'Folded to you. Open-raise or fold?'
      : spot.mode === 'vsRfi'
        ? `${spot.raiserPos} raises. Fold, call, or 3-bet?`
        : spot.mode === 'multiway'
          ? (MULTIWAY_MATCHUPS.find((x) => x.hero === spot.heroPos)?.description ?? 'What do you do?')
          : street === 'turn'
            ? 'BB checks the turn. Bet or check back?'
            : 'BB checks. Bet or check back?'

  const multiwayActive =
    spot.mode === 'multiway'
      ? (MULTIWAY_MATCHUPS.find((x) => x.hero === spot.heroPos)?.activeBefore ?? [])
      : []

  const gridLabel =
    spot.mode === 'rfi'
      ? `${spot.heroPos} opening range`
      : spot.mode === 'vsRfi'
        ? `${spot.heroPos} vs ${spot.raiserPos}`
        : spot.mode === 'multiway'
          ? `${spot.heroPos} decision`
          : `${spot.node?.board.match(/../g)?.join(' ')} (${street})`

  const feedbackTone = !result
    ? ''
    : result.quality === 'acceptable'
      ? 'bg-[#c79a4a]/10 border-[#c79a4a]/40'
      : result.isCorrect
        ? 'bg-sage/10 border-sage/40'
        : 'bg-heartred/10 border-heartred/40'

  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-28 pt-4 max-w-xl mx-auto">
      {/* mode toggle OR review header */}
      {reviewMode ? (
        <div className="flex items-center justify-between w-full rounded-2xl bg-sage/12 border border-sage/30 px-3 py-2">
          <span className="flex items-center gap-2 text-sage-dark font-semibold text-sm">
            <Repeat2 size={16} /> Reviewing mistakes · {reviewQueue.length} left
          </span>
          <button onClick={exitReview} className="text-ink2 hover:text-ink p-1 rounded-lg hover:bg-ink/5">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex gap-1 p-1 rounded-2xl bg-ink/[0.06] border border-line text-sm w-full">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => switchMode(m.id)}
              className={`flex-1 px-1.5 py-2 rounded-xl font-semibold transition text-xs ${
                mode === m.id ? 'bg-sage text-white shadow-[0_4px_12px_-4px_rgba(67,84,72,0.6)]' : 'text-ink2 hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* focus + review controls */}
      {!reviewMode && (
        <div className="flex items-center justify-between w-full gap-2">
          <button
            onClick={toggleFocus}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
              focusOn ? 'bg-sage/15 border-sage/40 text-sage-dark' : 'bg-paper2 border-line text-ink2 hover:text-ink'
            }`}
          >
            <Zap size={13} /> Focus my leaks
          </button>
          {mistakeBadge > 0 && (
            <button
              onClick={startReview}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border border-clay/40 bg-clay/10 text-clay hover:bg-clay/20 transition"
            >
              <Repeat2 size={13} /> Review {mistakeBadge}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between w-full text-sm">
        <span className="text-ink2">
          {spot.mode === 'postflop' ? `BTN vs BB · ${street ?? 'flop'}` : '100bb · 6-max cash'}
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 border transition ${
            streak >= 3 ? 'border-clay/40 bg-clay/10 text-clay' : 'border-line bg-paper2 text-ink2'
          }`}
        >
          <Flame size={15} className={streak >= 3 ? 'text-clay' : 'text-ink3'} />
          <span className="font-bold tabular-nums">{streak}</span>
        </span>
      </div>

      {history.length > 0 && <HandHistory history={history} />}

      <PokerTable
        heroPos={spot.heroPos}
        heroCards={spot.cards}
        raiserPos={spot.raiserPos}
        activePots={multiwayActive}
        board={spot.board}
        villain={spot.mode === 'postflop' ? { pos: 'BB', note: 'checks' } : undefined}
      />

      <p className="serif text-ink text-[17px] text-center leading-snug px-2">{prompt}</p>

      {!result ? (
        <div className={`grid gap-3 w-full max-w-sm ${spot.actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {spot.actions.map((a) => (
            <button key={a} onClick={() => answer(a)} className={`py-4 text-lg ${ACTION_STYLE[a]}`}>
              {ACTION_LABEL[a]} <span className="text-xs opacity-70">({KEY_HINT[a] ?? ''})</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-4 animate-pop pb-24">
          <div className={`w-full rounded-2xl p-4 text-sm leading-relaxed flex gap-3 border ${feedbackTone}`}>
            {result.quality === 'acceptable' ? (
              <MinusCircle size={22} className="text-[#b88a3a] shrink-0 mt-0.5" />
            ) : result.isCorrect ? (
              <CheckCircle2 size={22} className="text-sage shrink-0 mt-0.5" />
            ) : (
              <XCircle size={22} className="text-heartred shrink-0 mt-0.5" />
            )}
            <span className="text-ink">{result.explanation}</span>
          </div>
          <div className="w-full">
            <p className="text-xs text-ink2 mb-2 text-center">
              {gridLabel}:&nbsp;
              <span className="text-sage-dark font-medium">
                sage = {spot.mode === 'rfi' ? 'raise' : spot.mode === 'vsRfi' ? '3bet' : spot.mode === 'multiway' ? 'squeeze' : 'bet'}
              </span>
              {spot.mode === 'vsRfi' && <span className="text-dblue font-medium">, blue = call</span>}
              , ring = your hand
            </p>
            <RangeGrid cell={cellFor(spot)} highlight={spot.label} />
          </div>
        </div>
      )}

      {result && (
        <div className="fixed bottom-0 inset-x-0 z-20 flex justify-center gap-3 px-4 pb-[calc(4.25rem+env(safe-area-inset-bottom))] pt-10 bg-gradient-to-t from-paper via-paper/90 to-transparent pointer-events-none">
          {canContinue && (
            <button
              onClick={continueHand}
              className="btn btn-secondary pointer-events-auto flex-1 max-w-[11rem] py-4 text-base flex items-center justify-center gap-2"
            >
              <FastForward size={16} /> Turn
            </button>
          )}
          <button
            onClick={next}
            className="btn btn-primary pointer-events-auto flex-1 max-w-sm py-4 text-lg flex items-center justify-center gap-2"
          >
            {reviewMode && reviewQueue.length === 0 ? 'Done' : reviewMode ? 'Next' : 'Next hand'} <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
