import { gridLabels } from '../lib/cards'

export type CellKind = 'raise' | 'call' | 'fold'

const KIND_CLASS: Record<CellKind, string> = {
  raise: 'bg-sage text-white',
  call: 'bg-dblue text-white',
  fold: 'bg-[#e6dfcf] text-ink2',
}

interface Props {
  /** Map a 169-hand label to how it should be coloured (solid). */
  cell: (label: string) => CellKind
  /**
   * Optional bet/primary frequency 0..1 per hand. When provided, the cell is
   * rendered as a partial fill (solver-style mixed strategy) instead of solid.
   */
  freq?: (label: string) => number | null
  highlight?: string // hero's hand label
}

const GRID = gridLabels()

export default function RangeGrid({ cell, freq, highlight }: Props) {
  return (
    <div
      className="grid gap-[2px] w-full max-w-[420px] mx-auto select-none"
      style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
    >
      {GRID.flat().map((label) => {
        const isHero = label === highlight
        const f = freq ? freq(label) : null
        const ring = isHero ? 'ring-2 ring-ink z-10 font-bold scale-110 shadow-[0_0_8px_rgba(34,31,25,0.4)]' : ''

        if (f != null) {
          // mixed-frequency fill: sage bet portion rising over an oat base
          const pct = Math.round(f * 100)
          return (
            <div
              key={label}
              className={`relative aspect-square rounded-[4px] overflow-hidden bg-[#e6dfcf] ${ring}`}
              title={`${label} · bet ${pct}%`}
            >
              <div className="absolute inset-x-0 bottom-0 bg-sage" style={{ height: `${pct}%` }} />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] font-semibold text-ink/85">
                {label}
              </span>
            </div>
          )
        }

        return (
          <div
            key={label}
            className={`aspect-square flex items-center justify-center rounded-[4px] text-[9px] sm:text-[10px] font-semibold ${KIND_CLASS[cell(label)]} ${ring}`}
          >
            {label}
          </div>
        )
      })}
    </div>
  )
}
