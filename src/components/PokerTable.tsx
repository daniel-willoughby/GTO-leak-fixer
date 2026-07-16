import { actionIndex, POSITION_ORDER, type Position, type RfiPosition } from '../data/ranges'
import type { Card } from '../lib/cards'
import PlayingCard from './PlayingCard'
import ChipStack, { type ChipTone } from './ChipStack'

export interface Chip {
  pos: Position
  amount: number
  tone: ChipTone
}

/** One frame of a hand replay: explicit seat statuses + the acting seat. */
export interface ReplayFrame {
  seatStatus: Record<Position, 'hero' | 'active' | 'folded' | 'waiting'>
  chips: Chip[]
  pot: number
  board: Card[]
  action?: { pos: Position; label: string; anim: 'muck' | 'chips' | 'check' }
  seq: number
}

interface Props {
  heroPos: Position
  heroCards: [Card, Card]
  raiserPos?: RfiPosition
  /** Extra active (still-in) positions beyond hero for multiway spots */
  activePots?: Position[]
  /** Chips in front of each seat (blinds, opens, calls, 3-bets). */
  chips?: Chip[]
  /** Central pot to show (postflop). */
  pot?: number
  // postflop
  board?: Card[]
  villain?: { pos: Position; note: string }
  /** One-shot hero action animation: chips toss in (bet/raise/call) or cards muck (fold). */
  heroAnim?: { kind: 'chips' | 'muck'; seq: number } | null
  /** CSS gradient for the opponents' face-down card backs (equipped "deck"). */
  cardBack?: string
  /** CSS gradient for the felt surface (equipped "felt"). */
  felt?: string
  /** When set, the table renders this replay frame instead of the decision
      snapshot: explicit seat statuses, evolving chips/pot/board, per-seat action. */
  replay?: ReplayFrame | null
}

const DEFAULT_CARD_BACK = 'linear-gradient(150deg, #9c4234 0%, #863a2d 48%, #6f2f25 100%)'
const DEFAULT_FELT = 'radial-gradient(circle at 50% 34%, #7e9a85 0%, #67836f 46%, #51695a 100%)'

// Seat coordinates as % of the table container, seat 0 = hero (bottom). Seats
// trace CLOCKWISE to match POSITION_ORDER, so the player to hero's left (next
// clockwise position) sits on the left, e.g. the blinds sit left of the button.
const SEATS = [
  { left: 50, top: 89 }, // hero (bottom)
  { left: 10, top: 68 }, // lower-left
  { left: 9,  top: 28 }, // upper-left
  { left: 50, top: 14 }, // top (low enough that its cards fit above the pill, inside the table)
  { left: 91, top: 28 }, // upper-right
  { left: 90, top: 68 }, // lower-right
]

// Where a seat's bet chip sits during the hand replay. Explicit per physical
// seat (same index order as SEATS) instead of the generic inboard vector: the
// vector math kept landing chips (and their bb labels) on the seat's own
// tucked cards or under the pill on the side seats. Each slot is hand-placed
// in open felt, clear of the seat furniture, the 5-card board band
// (~x 26-74, y 42-58), and the central pot row (~y 31-37).
// Slots measured against the real mobile layout (343x257 container): a chip
// element (stack + bb label) spans ~11.5% x 16%, the 5-card board x 20-80 /
// y 40-60, the pot row x 36-64 / y 29-39, and each seat column ~16% x 26%.
const REPLAY_CHIP_POS = [
  { left: 50, top: 64 }, // hero (bottom) — label clear of the hole cards; the disc may tuck behind the board's bottom edge, which reads naturally
  { left: 27, top: 67 }, // lower-left — below the board, right of its seat
  { left: 26, top: 22 }, // upper-left — above the board, right of its seat
  { left: 30, top: 24 }, // top — below-left of its seat, left of the pot
  { left: 74, top: 22 }, // upper-right
  { left: 73, top: 67 }, // lower-right
]

type Status = 'hero' | 'raiser' | 'active' | 'folded' | 'waiting'

// Face-down cards for the other players. A warm claret back with a cream
// border so they read clearly as held cards and pop off the green felt.
function CardBack({ delay = 0, bg = DEFAULT_CARD_BACK }: { delay?: number; bg?: string }) {
  return (
    <div
      className="w-[1.6rem] h-[2.2rem] rounded-[5px] border-[1.5px] border-[#efe6d2]"
      style={{
        background: bg,
        boxShadow: '0 3px 7px rgba(34,31,25,0.45), 0 0 0 0.5px rgba(0,0,0,0.2)',
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

const SEAT_CLASS: Record<Status, string> = {
  hero: 'bg-paper2 text-ink border-paper2 shadow-[0_3px_10px_rgba(34,31,25,0.18)]',
  raiser: 'bg-heartred text-white border-[#9a3a26] shadow-[0_3px_10px_rgba(177,66,44,0.4)]',
  active: 'bg-paper2 text-ink border-paper2 shadow-[0_2px_8px_rgba(34,31,25,0.18)]',
  folded: 'bg-[#33423a] text-white/55 border-transparent line-through',
  waiting: 'bg-[#33423a] text-white border-[#283228] shadow-[0_2px_6px_rgba(34,31,25,0.25)]',
}

export default function PokerTable({ heroPos, heroCards, raiserPos, activePots = [], chips = [], pot, board, villain, heroAnim, cardBack = DEFAULT_CARD_BACK, felt = DEFAULT_FELT, replay = null }: Props) {
  const heroIdx = actionIndex(heroPos)
  // In replay mode the caller drives chips/pot/board/statuses directly.
  if (replay) {
    chips = replay.chips
    pot = replay.pot
    board = replay.board.length ? replay.board : undefined
  }
  const postflop = !!board
  // When a player still in the pot sits AFTER the hero in betting order, the
  // hand has been (re-)raised and folded back around to the hero, so the hero
  // is closing the action and everyone not still in has folded, the blinds
  // included. Otherwise the seats behind the hero are simply yet to act.
  const stillIn = [raiserPos, ...activePots].filter(Boolean) as Position[]
  const actionClosed = stillIn.some((p) => actionIndex(p) > heroIdx)
  const seats = SEATS.map((coord, i) => {
    const pos = POSITION_ORDER[(heroIdx + i) % POSITION_ORDER.length]
    let status: Status = 'waiting'
    if (replay) status = replay.seatStatus[pos]
    else if (pos === heroPos) status = 'hero'
    else if (postflop) status = pos === villain?.pos ? 'active' : 'folded'
    else if (pos === raiserPos) status = 'raiser'
    else if (activePots.includes(pos)) status = 'active'
    else if (actionIndex(pos) < heroIdx || actionClosed) status = 'folded'
    return { pos, coord, status }
  })

  // Seats always keep true clockwise position order around the table (hero at
  // the bottom, UTG clockwise after BB): the villain sits at their real spot
  // relative to the hero rather than being forced across the top, so the table
  // never reads "the wrong way round".

  // Dealer button puck on the felt next to the BTN seat. When the hero is on
  // the button, the bottom seat shows large hole cards, so park the puck to
  // their lower-right instead of the generic offset (which would cover them).
  const btn = seats.find((s) => s.pos === 'BTN')!
  const dx = 50 - btn.coord.left
  const dy = 50 - btn.coord.top
  const len = Math.hypot(dx, dy) || 1
  const dealer =
    heroPos === 'BTN'
      ? { left: 68, top: 80 }
      : {
          left: btn.coord.left + dx * 0.24 + (-dy / len) * 11,
          top: btn.coord.top + dy * 0.24 + (dx / len) * 11,
        }

  // Chips on the felt come from the caller (blinds, opens, calls, 3-bets per
  // mode); only render those whose seat is actually on the table.
  const bets = chips.filter((c) => seats.some((s) => s.pos === c.pos))
  // When the villain has a bet chip, it already shows the amount, so skip the
  // redundant "bets Xbb" text note (and avoid stacking the two on top seat).
  const villainHasBet = !!villain && bets.some((b) => b.pos === villain.pos)
  // Park each chip a uniform distance inboard of its own seat (toward center)
  // so stacks hug their player instead of drifting into the pot or each other.
  const chipPos = (coord: { left: number; top: number }) => {
    const dx = 50 - coord.left
    const dy = 50 - coord.top
    const len = Math.hypot(dx, dy) || 1
    // Seats above centre have their pill pushed down by the cards above it, and
    // the chip's inboard direction is straight down, so give top seats extra
    // clearance proportional to how downward the chip travels (none at bottom).
    const inset = 15 + 7 * Math.max(0, dy / len)
    return { left: coord.left + (dx / len) * inset, top: coord.top + (dy / len) * inset }
  }

  return (
    <div className="font-table relative w-full max-w-lg mx-auto aspect-[4/3] sm:aspect-[5/4]">
      {/* rail */}
      <div
        className="absolute inset-[10%] rounded-full p-[7px]"
        style={{
          background: 'linear-gradient(160deg, #6f5a45 0%, #5a4736 45%, #463727 100%)',
          boxShadow: '0 22px 45px -16px rgba(34,31,25,0.5), 0 1px 0 rgba(255,255,255,0.1) inset',
        }}
      >
        {/* felt */}
        <div
          className="relative w-full h-full rounded-full flex items-center justify-center"
          style={{
            background: felt,
            boxShadow: 'inset 0 3px 14px rgba(34,31,25,0.22), inset 0 0 60px rgba(34,31,25,0.16)',
          }}
        >
          {/* subtle inner ring */}
          <div className="absolute inset-[7%] rounded-full border border-white/[0.1]" />
          {board ? (
            <div className="flex gap-1.5 z-10">
              {board.map((c, i) => (
                <div key={i} className="animate-deal" style={{ animationDelay: `${i * 60}ms` }}>
                  <PlayingCard card={c} size="sm" />
                </div>
              ))}
            </div>
          ) : raiserPos ? (
            <span className="text-white/55 text-[10px] font-semibold tracking-[0.22em] serif italic">
              facing a raise
            </span>
          ) : null}
        </div>
      </div>

      {seats.map(({ pos, coord, status }) => (
        <div
          key={pos}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10"
          style={{ left: `${coord.left}%`, top: `${coord.top}%` }}
        >
          {/* hero hole cards, hidden while the fold/muck animation plays so the
              cards visibly leave the table (the muck overlay shows them sliding) */}
          {status === 'hero' && heroAnim?.kind !== 'muck' && (
            <div className="flex gap-1 mb-0.5">
              <div className="animate-deal">
                <PlayingCard card={heroCards[0]} size="sm" />
              </div>
              <div className="animate-deal" style={{ animationDelay: '70ms' }}>
                <PlayingCard card={heroCards[1]} size="sm" />
              </div>
            </div>
          )}
          {/* other players' face-down cards, above their pill (the top seat sits
              low enough that these still fit inside the table) */}
          {status !== 'hero' && status !== 'folded' && (
            <div className="flex gap-1 mb-0.5 animate-deal">
              <CardBack bg={cardBack} /><CardBack bg={cardBack} delay={70} />
            </div>
          )}
          <div
            className={`font-table px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide border min-w-[42px] text-center transition-colors duration-300 ${SEAT_CLASS[status]}`}
          >
            {pos}
          </div>
          {/* replay action label ("folds", "opens 2.5bb"): anchored to this
              seat's own column, so it can never drift onto another seat's
              cards, the board, or the pot, and it moves with the seat on any
              screen size. Absolutely positioned so the column doesn't reflow.
              Villains: just below their pill. Hero: beside the hole cards (the
              hero pill overflows the container bottom, where the label would
              collide with the tap-to-skip button under the table). */}
          {replay?.action?.pos === pos && (
            <span
              key={`lbl-${replay.seq}`}
              className={`animate-pop absolute z-20 font-table text-[9px] font-semibold text-white bg-[#3a352b]/85 px-1.5 py-0.5 rounded whitespace-nowrap ${
                status === 'hero' ? 'right-full top-[30%] mr-1' : 'left-1/2 top-full mt-1 -translate-x-1/2'
              }`}
            >
              {replay.action.label}
            </span>
          )}
          {/* villain action note (e.g. "checks"); skipped when a bet chip
              already conveys it, and on the top seat where the tucked cards
              need the room (the prompt text states the action anyway) */}
          {!replay && status === 'active' && villain && !villainHasBet && coord.top >= 15 && (
            <span className="font-table text-[10px] text-white/80 font-semibold">{villain.note}</span>
          )}
        </div>
      ))}

      {/* chips: posted blinds + the raiser's bet, in front of each player */}
      {bets.map((b) => {
        const idx = seats.findIndex((s) => s.pos === b.pos)
        // Whenever a board is on the table (replay frames AND the postflop
        // decision view) chips use the hand-placed slots, since the generic
        // inboard inset lands them on the board cards or their own seat.
        // Preflop drills keep the classic inset look. Keyed by amount so a
        // raise re-pops; the inner wrapper carries the landing animation (the
        // outer div's centering transform would fight the keyframe's).
        const p =
          replay || postflop
            ? REPLAY_CHIP_POS[idx]
            : b.pos === heroPos
              ? { left: 50, top: 61 }
              : chipPos(seats[idx].coord)
        // Toss direction: the chip slides in FROM its seat toward the slot, so
        // it reads as the player putting chips in (a pop-in-place read as the
        // chip just appearing). CSS vars feed the chip-set keyframe.
        const tdx = seats[idx].coord.left - p.left
        const tdy = seats[idx].coord.top - p.top
        const tlen = Math.hypot(tdx, tdy) || 1
        return (
          <div
            key={`chip-${b.pos}-${b.amount}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-[6]"
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
          >
            <div
              className="animate-chip-set"
              style={{
                ['--toss-x' as string]: `${((tdx / tlen) * 34).toFixed(1)}px`,
                ['--toss-y' as string]: `${((tdy / tlen) * 34).toFixed(1)}px`,
              }}
            >
              <ChipStack amount={b.amount} tone={b.tone} />
            </div>
          </div>
        )
      })}

      {/* central pot: compact single-line row (discs + amount) so it fits the
          narrow band between the villain's tucked cards and the board. Hidden at
          0 (preflop replay, before any street's bets have been swept in). */}
      {pot != null && pot > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[6]" style={{ top: '34%' }}>
        {/* keyed by amount so each street's sweep pops the pot afresh */}
        <div key={pot} className="animate-pop flex items-center gap-1.5">
          <div className="relative w-5 h-[26px]">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute left-0 w-5 h-5 rounded-full border-2 border-dashed"
                style={{
                  background: 'radial-gradient(circle at 38% 30%, #8fa896 0%, #5b7461 55%, #44594c 100%)',
                  borderColor: 'rgba(255,255,255,0.7)',
                  bottom: `${i * 3}px`,
                  boxShadow: '0 1px 2px rgba(34,31,25,0.4)',
                }}
              />
            ))}
          </div>
          <span className="font-mono text-[9px] leading-none font-semibold text-white px-1.5 py-px rounded bg-[#3a352b]/70 whitespace-nowrap tabular-nums">
            {pot} bb · POT
          </span>
        </div>
        </div>
      )}

      {/* one-shot hero action animation: chips toss toward the pot, or cards muck */}
      {heroAnim && (
        <div
          key={heroAnim.seq}
          className={`absolute left-1/2 z-[7] pointer-events-none ${
            heroAnim.kind === 'chips' ? 'animate-chips-in' : 'animate-cards-muck'
          }`}
        >
          {heroAnim.kind === 'chips' ? (
            <div className="relative w-5 h-[26px]">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute left-0 w-5 h-5 rounded-full border-2 border-dashed"
                  style={{
                    background: 'radial-gradient(circle at 38% 30%, #d99e86 0%, #c2785f 55%, #a85942 100%)',
                    borderColor: 'rgba(255,255,255,0.75)',
                    bottom: `${i * 3}px`,
                    boxShadow: '0 1px 2px rgba(34,31,25,0.4)',
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-1">
              <PlayingCard card={heroCards[0]} size="sm" />
              <PlayingCard card={heroCards[1]} size="sm" />
            </div>
          )}
        </div>
      )}

      {/* replay: a folding seat's cards fade + shrink toward the muck (the
          action label itself renders inside the seat, under its pill) */}
      {replay?.action?.anim === 'muck' && (() => {
        const seat = seats.find((s) => s.pos === replay.action!.pos)
        if (!seat) return null
        return (
          <div
            key={`muck-${replay.seq}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-[8] pointer-events-none animate-muck-out flex gap-1"
            style={{ left: `${seat.coord.left}%`, top: `${seat.coord.top - 8}%` }}
          >
            <CardBack bg={cardBack} /><CardBack bg={cardBack} />
          </div>
        )
      })()}

      {/* dealer button puck on the felt */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold z-10"
        style={{
          left: `${dealer.left}%`,
          top: `${dealer.top}%`,
          background: 'radial-gradient(circle at 35% 28%, #fcfaf4 0%, #efe9da 55%, #ddd2bb 100%)',
          color: '#435448',
          boxShadow: '0 2px 6px rgba(34,31,25,0.4), 0 0 0 1px rgba(255,255,255,0.6) inset',
        }}
        title="Dealer button"
      >
        D
      </div>
    </div>
  )
}
