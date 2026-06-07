import { gridLabels } from '../lib/cards'

export type CellKind = 'raise' | 'call' | 'fold'

const KIND_CLASS: Record<CellKind, string> = {
  raise: 'bg-sage text-white',
  call: 'bg-dblue text-white',
  fold: 'bg-[#e9e3d6] text-ink3',
}

interface Props {
  /** Map a 169-hand label to how it should be coloured. */
  cell: (label: string) => CellKind
  highlight?: string // hero's hand label
}

const GRID = gridLabels()

export default function RangeGrid({ cell, highlight }: Props) {
  return (
    <div
      className="grid gap-[2px] w-full max-w-[420px] mx-auto select-none"
      style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
    >
      {GRID.flat().map((label) => {
        const kind = cell(label)
        const isHero = label === highlight
        return (
          <div
            key={label}
            className={[
              'aspect-square flex items-center justify-center rounded-[4px] text-[9px] sm:text-[10px] font-semibold',
              KIND_CLASS[kind],
              isHero ? 'ring-2 ring-ink z-10 font-bold scale-110 shadow-[0_0_8px_rgba(34,31,25,0.4)]' : '',
            ].join(' ')}
          >
            {label}
          </div>
        )
      })}
    </div>
  )
}
