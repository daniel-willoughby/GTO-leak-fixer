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
      return
    }

    bump('3-bet or multiway pot')
  })

  const correct = decisions.filter((d) => d.isCorrect).length
  const byCategory = aggregate(decisions, (d) => d.category)
  const weakCategories = byCategory.filter((b) => b.attempts >= 2 && b.errorRate > 0).map((b) => b.key as HandCategory)

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
  }
}
