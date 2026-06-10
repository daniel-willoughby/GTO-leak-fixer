// PokerStars 6-max hand-history parser + preflop leak grader.
// Scoped to what we can grade with confidence: 6-handed preflop decisions
// that are either RFI (folded to hero) or facing a single raise (vs-RFI).
// Multiway, 3-bet+, limped, and non-6-handed spots are counted as "ungraded".

import { handLabel, parseCards } from './cards'
import { isRfiHand, type Position, type RfiPosition } from '../data/ranges'
import { MATCHUPS, respond } from '../data/vsRfi'
import { classifyHand, type HandCategory } from './spot'

// Physical seat order clockwise starting at the button.
const CLOCKWISE_FROM_BTN: Position[] = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']
const RFI_SET = new Set<Position>(['UTG', 'HJ', 'CO', 'BTN', 'SB'])

export interface GradedDecision {
  handIndex: number
  kind: 'rfi' | 'vsRfi'
  heroPos: Position
  raiserPos?: Position
  label: string
  category: HandCategory
  heroAction: string // 'raise' | 'call' | 'fold' | 'limp'
  correctAction: string
  isCorrect: boolean
}

export interface LeakBar {
  key: string
  attempts: number
  errors: number
  errorRate: number
}

/** A heads-up flop tendency: how often hero did the thing, out of N spots. */
export interface PostflopStat {
  spots: number
  hits: number
  freq: number
}

export interface ImportReport {
  handsFound: number
  graded: number
  correct: number
  accuracy: number
  ungraded: number
  reasons: Record<string, number> // why hands were ungraded
  decisions: GradedDecision[]
  byPosition: LeakBar[]
  byCategory: LeakBar[]
  weakCategories: HandCategory[]
  /** Flop c-bet frequency as the heads-up preflop raiser. */
  cbet?: PostflopStat
  /** Fold-to-flop-c-bet frequency as the heads-up preflop caller. */
  foldToCbet?: PostflopStat
}

interface Acc {
  spots: number
  hits: number
}

/** Parse the flop of a heads-up pot and tally hero's c-bet / fold-to-c-bet. */
function parseFlop(lines: string[], heroName: string, heroIsAggressor: boolean, cbet: Acc, faceCbet: Acc) {
  const flopIdx = lines.findIndex((l) => /^\*\*\* FLOP \*\*\*/i.test(l))
  if (flopIdx < 0) return
  let fend = lines.findIndex((l, i) => i > flopIdx && /^\*\*\* /.test(l))
  if (fend < 0) fend = lines.length
  const actors: { name: string; act: string }[] = []
  for (let i = flopIdx + 1; i < fend; i++) {
    const m = lines[i].match(/^(.+?): (folds|checks|calls|raises|bets)/)
    if (m) actors.push({ name: m[1], act: m[2] })
  }
  const names = new Set(actors.map((a) => a.name))
  if (names.size !== 2 || !names.has(heroName)) return // heads-up with hero only
  if (heroIsAggressor) {
    // c-bet decision = hero's first flop action, as long as no one bet into them
    const idxH = actors.findIndex((a) => a.name === heroName)
    if (idxH < 0) return
    if (actors.slice(0, idxH).some((a) => a.act === 'bets' || a.act === 'raises')) return // hero faced a donk
    const act = actors[idxH].act
    if (act === 'bets') {
      cbet.spots++
      cbet.hits++
    } else if (act === 'checks') {
      cbet.spots++
    }
  } else {
    // fold-to-c-bet = hero's first action AFTER the villain's flop bet (handles the
    // common OOP line: hero checks, villain bets, hero then folds/calls/raises)
    const villBetIdx = actors.findIndex((a) => a.name !== heroName && a.act === 'bets')
    if (villBetIdx < 0) return
    const resp = actors.slice(villBetIdx + 1).find((a) => a.name === heroName)
    if (!resp) return
    faceCbet.spots++
    if (resp.act === 'folds') faceCbet.hits++
  }
}

interface SeatInfo {
  seat: number
  name: string
}

function splitHands(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => /hold'?em/i.test(b) && /\*\*\* HOLE CARDS \*\*\*/i.test(b))
}

function aggregate(decisions: GradedDecision[], pick: (d: GradedDecision) => string): LeakBar[] {
  const map = new Map<string, { attempts: number; errors: number }>()
  for (const d of decisions) {
    const k = pick(d)
    const cur = map.get(k) ?? { attempts: 0, errors: 0 }
    cur.attempts++
    if (!d.isCorrect) cur.errors++
    map.set(k, cur)
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v, errorRate: v.attempts ? v.errors / v.attempts : 0 }))
    .sort((a, b) => b.errorRate - a.errorRate || b.attempts - a.attempts)
}

export function parseHandHistory(text: string): ImportReport {
  const hands = splitHands(text)
  const decisions: GradedDecision[] = []
  const reasons: Record<string, number> = {}
  const bump = (r: string) => (reasons[r] = (reasons[r] ?? 0) + 1)
  const cbetAcc: Acc = { spots: 0, hits: 0 }
  const faceCbetAcc: Acc = { spots: 0, hits: 0 }

  hands.forEach((hand, idx) => {
    const lines = hand.split('\n').map((l) => l.trim())

    // button seat
    const btnMatch = hand.match(/Seat #(\d+) is the button/)
    if (!btnMatch) return bump('no button line')
    const buttonSeat = Number(btnMatch[1])

    // seats
    const seats: SeatInfo[] = []
    for (const l of lines) {
      const m = l.match(/^Seat (\d+): (.+?) \(\$?[\d.,]+ in chips\)/)
      if (m) seats.push({ seat: Number(m[1]), name: m[2] })
    }
    if (seats.length !== 6) return bump('not 6-handed')

    // hero
    const dealt = hand.match(/Dealt to (.+?) \[(\w\w) (\w\w)\]/)
    if (!dealt) return bump('no hero cards')
    const heroName = dealt[1]
    const cards = parseCards(dealt[2] + dealt[3])
    const label = handLabel(cards[0], cards[1])
    const category = classifyHand(label)

    // map seats -> positions
    seats.sort((a, b) => a.seat - b.seat)
    const btnIdx = seats.findIndex((s) => s.seat === buttonSeat)
    if (btnIdx < 0) return bump('button seat empty')
    const posOf = new Map<string, Position>()
    for (let i = 0; i < seats.length; i++) {
      const s = seats[(btnIdx + i) % seats.length]
      posOf.set(s.name, CLOCKWISE_FROM_BTN[i])
    }
    const heroPos = posOf.get(heroName)
    if (!heroPos) return bump('hero seat not found')

    // preflop actions
    const start = lines.findIndex((l) => /\*\*\* HOLE CARDS \*\*\*/i.test(l))
    let end = lines.findIndex((l, i) => i > start && /^\*\*\* /.test(l))
    if (end < 0) end = lines.length
    const actions: { name: string; act: string }[] = []
    for (let i = start + 1; i < end; i++) {
      const m = lines[i].match(/^(.+?): (folds|checks|calls|raises|bets)/)
      if (m) actions.push({ name: m[1], act: m[2] })
    }

    // find hero's first action + context
    let raisesBefore = 0
    let callsBefore = 0
    let lastRaiser: string | null = null
    let heroAct: string | null = null
    for (const a of actions) {
      if (a.name === heroName) {
        heroAct = a.act
        break
      }
      if (a.act === 'raises') {
        raisesBefore++
        lastRaiser = a.name
      } else if (a.act === 'calls') {
        callsBefore++
      }
    }
    if (!heroAct) return bump('hero did not act')
    if (heroAct === 'checks') return bump('hero checked option')

    // --- RFI: folded to hero, no raise, no limpers ---
    if (raisesBefore === 0) {
      if (callsBefore > 0) return bump('limped pot')
      if (!RFI_SET.has(heroPos)) return bump('BB with option')
      const correct = isRfiHand(heroPos as RfiPosition, label) ? 'raise' : 'fold'
      const heroAction = heroAct === 'raises' ? 'raise' : heroAct === 'calls' ? 'limp' : 'fold'
      decisions.push({
        handIndex: idx,
        kind: 'rfi',
        heroPos,
        label,
        category,
        heroAction,
        correctAction: correct,
        isCorrect: heroAction === correct,
      })
      // hero opened → if it goes heads-up to a flop, hero is the c-bettor
      if (heroAction === 'raise') parseFlop(lines, heroName, true, cbetAcc, faceCbetAcc)
      return
    }

    // --- vs-RFI: exactly one raise, no callers in between ---
    if (raisesBefore === 1 && callsBefore === 0 && lastRaiser) {
      const raiserPos = posOf.get(lastRaiser)
      if (!raiserPos) return bump('raiser unknown')
      const m = MATCHUPS.find((x) => x.raiser === raiserPos && x.hero === heroPos)
      if (!m) return bump('matchup not modelled')
      const correct = respond(m, label)
      const heroAction = heroAct === 'raises' ? '3bet' : heroAct === 'calls' ? 'call' : 'fold'
      decisions.push({
        handIndex: idx,
        kind: 'vsRfi',
        heroPos,
        raiserPos,
        label,
        category,
        heroAction,
        correctAction: correct,
        isCorrect: heroAction === correct,
      })
      // hero called the open → villain is the c-bettor; track hero's response
      if (heroAction === 'call') parseFlop(lines, heroName, false, cbetAcc, faceCbetAcc)
      return
    }

    bump('3-bet or multiway pot')
  })

  const correct = decisions.filter((d) => d.isCorrect).length
  const byCategory = aggregate(decisions, (d) => d.category)
  const weakCategories = byCategory.filter((b) => b.errors > 0).map((b) => b.key as HandCategory)

  const stat = (a: Acc): PostflopStat | undefined =>
    a.spots >= 4 ? { spots: a.spots, hits: a.hits, freq: a.hits / a.spots } : undefined

  return {
    handsFound: hands.length,
    graded: decisions.length,
    correct,
    accuracy: decisions.length ? correct / decisions.length : 0,
    ungraded: hands.length - decisions.length,
    reasons,
    decisions,
    byPosition: aggregate(decisions, (d) => d.heroPos),
    byCategory,
    weakCategories,
    cbet: stat(cbetAcc),
    foldToCbet: stat(faceCbetAcc),
  }
}
