// The beginner guided curriculum: an ordered list of short concept lessons,
// each followed by scoped drilling. Reuses the existing range/matchup/node data
// (no new poker data). Lessons unlock one at a time as the previous is completed.

import { Hand, Compass, ShieldAlert, Crosshair, Swords, TrendingUp, Layers, Spade, type LucideIcon } from 'lucide-react'
import type { DrillMode } from '../lib/spot'
import type { Position, RfiPosition } from './ranges'

export interface LessonScope {
  /** Pin an RFI lesson to one position. */
  lockPos?: RfiPosition
  /** Pin a vs-RFI lesson to one matchup. */
  lockMatchup?: { raiser: RfiPosition; hero: Position }
}

export interface Lesson {
  id: string
  title: string
  /** Section this lesson belongs to on the Lessons tab. */
  group: string
  /** One-line subtitle on the path card. */
  blurb: string
  icon: LucideIcon
  /** Teaching copy with [term] markers resolved by GlossaryText. */
  concept: string
  mode: DrillMode
  scope?: LessonScope
  /** Correct answers needed to complete the lesson. */
  goal: number
  /** Shown on the card when this lesson opens up a new mode. */
  unlocksLabel?: string
}

export const CURRICULUM: Lesson[] = [
  {
    id: 'rfi-btn',
    group: 'Opening hands',
    title: 'Should you even play this hand?',
    blurb: 'The raise-or-fold rule',
    icon: Hand,
    mode: 'rfi',
    scope: { lockPos: 'BTN' },
    goal: 8,
    concept:
      'Everyone before you folded, so the pot is yours to attack. Your only good moves are to [open] (raise) or fold, never to [limp]. On the [button] you act last after the flop, so you can profitably play almost half your hands. Raise the strong ones, fold the junk.',
  },
  {
    id: 'rfi-co',
    group: 'Opening hands',
    title: 'Position is power',
    blurb: 'Why late seats play more hands',
    icon: Compass,
    mode: 'rfi',
    scope: { lockPos: 'CO' },
    goal: 8,
    concept:
      'The later you sit, the more hands you can [open]. From the [cutoff] only three players can act behind you, so you still raise a wide [range]. [Position] is the single biggest edge in poker: play more hands when you have it, fewer when you do not.',
  },
  {
    id: 'rfi-utg',
    group: 'Opening hands',
    title: 'Tight from up front',
    blurb: 'Respecting early position',
    icon: ShieldAlert,
    mode: 'rfi',
    scope: { lockPos: 'UTG' },
    goal: 8,
    concept:
      '[Under the gun] you act first, with five players still to wake up behind you. That means you need stronger hands to [open]. When in doubt up front, fold. Discipline here saves you from tough spots later in the hand.',
  },
  {
    id: 'rfi-sb',
    group: 'Opening hands',
    title: 'Stealing from the small blind',
    blurb: 'Wide raises, one player left',
    icon: Crosshair,
    mode: 'rfi',
    scope: { lockPos: 'SB' },
    goal: 8,
    concept:
      'From the [small blind] only the [big blind] is left to act. You already have chips in the pot, so you raise a wide, aggressive [range] to [steal] the [blinds]. But you will be [out of position] after the flop, so the very weakest hands still fold.',
  },
  {
    id: 'vsrfi-bb',
    group: 'Facing a raise',
    title: 'Someone raised before you',
    blurb: 'Fold, call, or 3-bet',
    icon: Swords,
    mode: 'vsRfi',
    scope: { lockMatchup: { raiser: 'CO', hero: 'BB' } },
    goal: 8,
    concept:
      'Now a player has [open]ed before you and you are in the [big blind]. You have three choices: fold, [call] to see a flop, or [3-bet] (re-raise) with your best hands. You get a price discount to call here, so you defend wide, but the weakest hands still fold.',
  },
  {
    id: 'vsrfi-3bet',
    group: 'Facing a raise',
    title: '3-betting for value',
    blurb: 'When to re-raise',
    icon: TrendingUp,
    mode: 'vsRfi',
    scope: { lockMatchup: { raiser: 'CO', hero: 'BTN' } },
    goal: 8,
    concept:
      'A [3-bet] is a re-raise. You do it with strong hands for [value], and with a few hands as a [bluff] to apply pressure. On the [button] you are [in position], so you can also [call] and play plenty of flops with the betting lead behind you.',
  },
  {
    id: 'multiway',
    group: 'Beyond the basics',
    title: 'Playing a multiway pot',
    blurb: 'Squeezing over a raise and a call',
    icon: Layers,
    mode: 'multiway',
    goal: 6,
    concept:
      'Sometimes a player raises and another [call]s before it reaches you. With a strong hand you can [squeeze]: a big re-raise over both of them to win the dead money and play heads-up. Multiway pots are dangerous, so continue only with hands that hold up against several opponents.',
  },
  {
    id: 'postflop',
    group: 'Beyond the basics',
    title: 'Betting after the flop',
    blurb: 'C-bet or check',
    icon: Spade,
    mode: 'postflop',
    goal: 6,
    concept:
      'After the flop you decide whether to [c-bet] (continuation bet) or [check]. Bet your strong hands for [value] and your [draw]s as a [semi-bluff]. Check the hands that are not strong enough to bet but still want to see another card cheaply.',
  },
]

export const lessonById = (id: string): Lesson | undefined => CURRICULUM.find((l) => l.id === id)
