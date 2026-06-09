import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Flame,
  ArrowRight,
  ArrowLeft,
  FastForward,
  Zap,
  Repeat2,
  X,
  Lightbulb,
  Sparkles,
} from 'lucide-react'
import {
  ACTION_LABEL,
  buildContinuationSpot,
  generateSpot,
  judge,
  multiwayOf,
  promptFor,
  hintFor,
  seedKey,
  seedOf,
  spotFromSeed,
  type Action,
  type Difficulty,
  type DrillMode,
  type FocusRequest,
  type GenOptions,
  type HandCategory,
  type Judgement,
  type Spot,
} from '../lib/spot'
import type { Level } from '../lib/level'
import { lessonProgress, recordLessonCorrect } from '../lib/level'
import type { Lesson } from '../data/curriculum'
import GlossaryText from './GlossaryText'
import { isRfiHand, type Position, type RfiPosition } from '../data/ranges'
import { MATCHUPS, respond } from '../data/vsRfi'
import { respondMultiway } from '../data/multiway'
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
import PokerTable, { type Chip } from './PokerTable'
import RangeGrid, { type CellKind } from './RangeGrid'

/** Chips in front of each seat for the current spot (blinds, opens, calls, 3-bets). */
function chipsFor(spot: Spot): Chip[] {
  if (spot.mode === 'postflop') return []
  if (spot.mode === 'multiway') {
    const m = multiwayOf(spot)
    if (!m) return []
    return Object.entries(m.bets).map(([pos, amt]) => ({
      pos: pos as Position,
      amount: amt,
      tone: amt > 1 ? 'bet' : 'blind',
    }))
  }
  const map: Partial<Record<Position, Chip>> = {
    SB: { pos: 'SB', amount: 0.5, tone: 'blind' },
    BB: { pos: 'BB', amount: 1, tone: 'blind' },
  }
  if (spot.mode === 'vsRfi' && spot.raiserPos) {
    map[spot.raiserPos] = { pos: spot.raiserPos, amount: 2.5, tone: 'bet' }
  }
  return Object.values(map)
}
import HandHistory from './HandHistory'

interface Props {
  onProgress: () => void
  /** A targeted-drill request from the Leaks report or hand-history import. */
  requestFocus?: FocusRequest | null
  onFocusConsumed?: () => void
  difficulty?: Difficulty
  /** Experience level — drives prompt wording, hints, and explanation depth. */
  level?: Level
  /** When set, run as a scoped beginner lesson instead of free play. */
  lesson?: Lesson | null
  /** Leave the lesson and return to the learning path. */
  onExitLesson?: () => void
}

const ACTION_STYLE: Record<Action, string> = {
  fold: 'btn btn-secondary',
  call: 'btn btn-sky',
  raise: 'btn btn-primary',
  '3bet': 'btn btn-primary',
  check: 'btn btn-secondary',
  bet: 'btn btn-primary',
  bet33: 'btn btn-primary',
  bet75: 'btn btn-primary',
  squeeze: 'btn btn-primary',
  'cold-4bet': 'btn btn-primary',
}

const KEY_HINT: Record<string, string> = { fold: 'F', call: 'C', raise: 'R', '3bet': 'T', check: 'K', bet: 'B', bet33: 'B', bet75: 'V', squeeze: 'S', 'cold-4bet': '4' }

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
    const m = multiwayOf(spot)
    if (!m) return () => 'fold'
    return (label) => {
      const a = respondMultiway(m, label)
      return a === 'squeeze' || a === 'cold-4bet' || a === '3bet' ? 'raise' : a === 'call' ? 'call' : 'fold'
    }
  }
  const m = MATCHUPS.find((x) => x.raiser === spot.raiserPos && x.hero === spot.heroPos)!
  return (label) => {
    const a = respond(m, label)
    return a === '3bet' ? 'raise' : a === 'call' ? 'call' : 'fold'
  }
}

/** Per-hand bet frequency for the postflop strategy grid (B-style fill). */
function freqFor(spot: Spot): ((label: string) => number | null) | undefined {
  if (spot.mode !== 'postflop' || !spot.node) return undefined
  const node = spot.node
  return (label) => {
    const s = strategyFor(node, label)
    if (!s) return null
    // total bet frequency across all sizes (B-style fill = how often you bet)
    return node.actions.reduce((sum, a, i) => (a === 'check' ? sum : sum + (s.freqs[i] ?? 0)), 0)
  }
}

export default function DrillScreen({
  onProgress,
  requestFocus,
  onFocusConsumed,
  difficulty = 'all',
  level = 'intermediate',
  lesson = null,
  onExitLesson,
}: Props) {
  const scopeOpts: GenOptions = lesson?.scope
    ? { lockPos: lesson.scope.lockPos, lockMatchup: lesson.scope.lockMatchup }
    : {}
  const [mode, setMode] = useState<DrillMode>(() => (lesson ? lesson.mode : 'rfi'))
  const [spot, setSpot] = useState<Spot>(() => generateSpot(lesson ? lesson.mode : 'rfi', scopeOpts))
  const [result, setResult] = useState<Judgement | null>(null)
  const [streak, setStreak] = useState(0)
  const [canContinue, setCanContinue] = useState(false)
  const [showHint, setShowHint] = useState(false)
  // beginner lesson progress (persisted in localStorage)
  const [lessonCorrect, setLessonCorrect] = useState(() => (lesson ? lessonProgress(lesson.id).correct : 0))
  const [lessonDone, setLessonDone] = useState(() => (lesson ? lessonProgress(lesson.id).done : false))
  // adaptive focus
  const [focusOn, setFocusOn] = useState(false)
  const [focusCats, setFocusCats] = useState<Set<HandCategory>>(new Set())
  // a targeted-leak drill: pin RFI to a leaky seat + show a banner label
  const [focusPos, setFocusPos] = useState<RfiPosition | null>(null)
  const [focusLabel, setFocusLabel] = useState<string | null>(null)
  // review queue (spaced repetition)
  const [reviewQueue, setReviewQueue] = useState<MistakeRecord[]>([])
  const [reviewMode, setReviewMode] = useState(false)
  const [mistakeBadge, setMistakeBadge] = useState(0)

  // load weak categories + mistake count once
  useEffect(() => {
    weakCategories().then((cats) => setFocusCats(new Set(cats)))
    mistakeCount().then(setMistakeBadge)
  }, [])

  // re-deal when difficulty changes (unless mid-feedback, reviewing, or in a lesson)
  useEffect(() => {
    if (!reviewMode && !result && !lesson)
      setSpot(generateSpot(mode, { focus: focusOn ? focusCats : undefined, lockPos: focusPos ?? undefined, difficulty }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty])

  // targeted-drill request from the Leaks report or import
  useEffect(() => {
    if (!requestFocus) return
    const cats = requestFocus.cats?.length ? new Set(requestFocus.cats) : new Set<HandCategory>()
    const nextMode = requestFocus.mode ?? (requestFocus.lockPos ? 'rfi' : mode === 'postflop' ? 'rfi' : mode)
    const lockPos = requestFocus.lockPos ?? null
    setFocusCats(cats)
    setFocusOn(cats.size > 0)
    setFocusPos(lockPos)
    setFocusLabel(requestFocus.label ?? null)
    setMode(nextMode)
    setStreak(0)
    setSpot(
      generateSpot(nextMode, {
        focus: cats.size > 0 ? cats : undefined,
        lockPos: lockPos ?? undefined,
        difficulty,
      }),
    )
    setResult(null)
    setCanContinue(false)
    setShowHint(false)
    onFocusConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestFocus])

  function dealNormal(m: DrillMode = mode) {
    setSpot(
      lesson
        ? generateSpot(lesson.mode, scopeOpts)
        : generateSpot(m, {
            focus: focusOn ? focusCats : undefined,
            lockPos: focusPos ?? undefined,
            difficulty,
          }),
    )
    setResult(null)
    setCanContinue(false)
    setShowHint(false)
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
        setShowHint(false)
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
    if (m === mode || reviewMode || lesson) return
    setMode(m)
    setStreak(0)
    dealNormal(m)
  }

  const focusActive = focusOn || !!focusPos

  function toggleFocus() {
    if (focusActive) {
      // clear any active focus (category bias + positional leak lock + banner)
      setFocusOn(false)
      setFocusPos(null)
      setFocusLabel(null)
    } else {
      setFocusOn(true)
      weakCategories().then((cats) => setFocusCats(new Set(cats)))
    }
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
    setShowHint(false)
    playDeal()
  }

  async function answer(action: Action) {
    if (result || !spot.actions.includes(action)) return
    const j = judge(spot, action, level)
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
    // beginner lesson: advance the goal on every correct (or acceptable) answer
    if (lesson && j.isCorrect && !lessonDone) {
      const st = recordLessonCorrect(lesson.id, lesson.goal)
      setLessonCorrect(st.correct)
      if (st.done) setLessonDone(true)
    }
    if (
      !lesson &&
      spot.mode === 'postflop' &&
      !reviewMode &&
      action !== 'bet75' && // continuation data follows the check / ⅓ line only
      (spot.handState?.street === 'flop' || spot.handState?.street === 'turn')
    ) {
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
      else if (k === 'b') answer(spot.actions.includes('bet33') ? 'bet33' : 'bet')
      else if (k === 'v') answer('bet75')
      else if (k === 's') answer('squeeze')
      else if (k === '4') answer('cold-4bet')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const history = spot.handState?.history ?? []
  const street = spot.handState?.street
  const prompt = promptFor(spot, level)

  const multiwayActive = spot.mode === 'multiway' ? (multiwayOf(spot)?.activeBefore ?? []) : []

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

  const navButtons = (
    <>
      {canContinue && (
        <button
          onClick={continueHand}
          className="btn btn-secondary pointer-events-auto flex-1 max-w-[11rem] py-4 text-base flex items-center justify-center gap-2"
        >
          <FastForward size={16} /> {spot.handState?.street === 'turn' ? 'River' : 'Turn'}
        </button>
      )}
      <button
        onClick={lesson && lessonDone ? onExitLesson : next}
        className="btn btn-primary pointer-events-auto flex-1 max-w-sm py-4 text-lg flex items-center justify-center gap-2"
      >
        {lesson && lessonDone
          ? 'Finish lesson'
          : reviewMode && reviewQueue.length === 0
            ? 'Done'
            : reviewMode
              ? 'Next'
              : 'Next hand'}{' '}
        <ArrowRight size={18} />
      </button>
    </>
  )

  return (
    <div className="flex flex-col items-center gap-3 px-4 pb-28 lg:pb-12 pt-4 max-w-xl lg:max-w-5xl mx-auto">
      {/* lesson header OR mode toggle OR review header */}
      {lesson ? (
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onExitLesson}
              className="flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-ink2 hover:text-ink"
            >
              <ArrowLeft size={16} /> Path
            </button>
            <span className="serif min-w-0 flex-1 truncate text-center text-sm text-ink">{lesson.title}</span>
            <span className="text-xs tabular-nums text-ink3">
              {Math.min(lessonCorrect, lesson.goal)}/{lesson.goal}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
            <div
              className="h-full rounded-full bg-sage transition-all"
              style={{ width: `${Math.min(100, (lessonCorrect / lesson.goal) * 100)}%` }}
            />
          </div>
        </div>
      ) : reviewMode ? (
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
      {!reviewMode && !lesson && (
        <div className="flex items-center justify-between w-full gap-2">
          <button
            onClick={toggleFocus}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
              focusActive ? 'bg-sage/15 border-sage/40 text-sage-dark' : 'bg-paper2 border-line text-ink2 hover:text-ink'
            }`}
          >
            <Zap size={13} /> {focusActive ? (focusLabel ?? 'Focusing leaks') : 'Focus my leaks'}
            {focusActive && <X size={12} className="opacity-70" />}
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

      {/* main: table | decision (two columns on desktop) */}
      <div className="w-full flex flex-col items-center gap-3 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
        {/* table column */}
        <div className="w-full flex flex-col items-center gap-3">
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
        chips={chipsFor(spot)}
        pot={spot.mode === 'postflop' ? (street === 'river' ? 15 : street === 'turn' ? 9 : 5.5) : undefined}
        board={spot.board}
        villain={spot.mode === 'postflop' ? { pos: 'BB', note: 'checks' } : undefined}
      />
        </div>

        {/* decision column */}
        <div className="w-full flex flex-col items-center gap-3">
      <p className="serif text-ink text-[17px] lg:text-xl text-center leading-snug px-2">{prompt}</p>

      {!result ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          {level === 'beginner' && (
            <div className="flex w-full flex-col items-center gap-2">
              {showHint && (
                <div className="w-full rounded-xl border border-line bg-paper2 p-3 text-sm leading-relaxed text-ink2">
                  <GlossaryText text={hintFor(spot)} />
                </div>
              )}
              <button
                onClick={() => setShowHint((h) => !h)}
                className="flex items-center gap-1.5 text-xs font-semibold text-sage-dark hover:text-sage"
              >
                <Lightbulb size={13} /> {showHint ? 'Hide hint' : 'Need a hint?'}
              </button>
            </div>
          )}
          <div className={`grid w-full gap-3 ${spot.actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {spot.actions.map((a) => (
              <button key={a} onClick={() => answer(a)} className={`py-4 text-lg ${ACTION_STYLE[a]}`}>
                {ACTION_LABEL[a]} <span className="text-xs opacity-70">({KEY_HINT[a] ?? ''})</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-4 animate-pop pb-24">
          {lesson && lessonDone && (
            <div className="flex w-full items-center gap-3 rounded-2xl border border-sage/40 bg-sage/10 p-4">
              <Sparkles size={22} className="shrink-0 text-sage" />
              <span className="text-sm text-ink">
                <span className="serif font-semibold">Lesson complete.</span> Nicely done — tap Finish to head back to
                your path.
              </span>
            </div>
          )}
          <div className={`w-full rounded-2xl p-4 text-sm leading-relaxed flex gap-3 border ${feedbackTone}`}>
            {result.quality === 'acceptable' ? (
              <MinusCircle size={22} className="text-[#b88a3a] shrink-0 mt-0.5" />
            ) : result.isCorrect ? (
              <CheckCircle2 size={22} className="text-sage shrink-0 mt-0.5" />
            ) : (
              <XCircle size={22} className="text-heartred shrink-0 mt-0.5" />
            )}
            {level === 'beginner' ? (
              <GlossaryText text={result.explanation} className="text-ink" />
            ) : (
              <span className="text-ink">{result.explanation}</span>
            )}
          </div>
          <div className="w-full">
            <p className="text-xs text-ink2 mb-2 text-center">
              {gridLabel}:&nbsp;
              {spot.mode === 'postflop' ? (
                <span className="text-sage-dark font-medium">sage fill = bet frequency</span>
              ) : (
                <span className="text-sage-dark font-medium">
                  sage = {spot.mode === 'rfi' ? 'raise' : spot.mode === 'vsRfi' ? '3bet' : 'raise'}
                </span>
              )}
              {spot.mode === 'vsRfi' && <span className="text-dblue font-medium">, blue = call</span>}
              , ring = your hand
            </p>
            <RangeGrid cell={cellFor(spot)} freq={freqFor(spot)} highlight={spot.label} />
          </div>
        </div>
      )}

          {/* desktop: inline action bar under the decision column */}
          {result && <div className="hidden lg:flex w-full justify-center gap-3 pt-1">{navButtons}</div>}
        </div>
      </div>

      {/* mobile: sticky action bar */}
      {result && (
        <div className="fixed bottom-0 inset-x-0 z-20 lg:hidden flex justify-center gap-3 px-4 pb-[calc(4.25rem+env(safe-area-inset-bottom))] pt-10 bg-gradient-to-t from-paper via-paper/90 to-transparent pointer-events-none">
          {navButtons}
        </div>
      )}
    </div>
  )
}
