const PILL = 'text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap'

/** Compact scrollable pill row showing the action history for the current hand. */
export default function HandHistory({ history }: { history: string[] }) {
  if (!history.length) return null
  // Pin the preflop open (the aggressor — always history[0]) at the left so
  // it's never scrolled off, then show the rest most-recent-first so the
  // current decision context leads. Back-chevrons read reverse-chronological.
  const opener = history[0]
  const rest = history.slice(1).reverse()
  return (
    <div className="w-full overflow-x-auto pb-0.5">
      <div className="flex items-center gap-1.5 min-w-max px-1">
        {/* aggressor — clay accent, pinned */}
        <span className={`${PILL} bg-clay/15 text-clay border border-clay/40`}>{opener}</span>
        {rest.length > 0 && <span className="text-ink3 text-[11px]">·</span>}
        {rest.map((item, i) => {
          const isBoard = item.startsWith('Flop:') || item.startsWith('Turn:') || item.startsWith('River:')
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className={`${PILL} ${
                  isBoard ? 'bg-sage/15 text-sage-dark border border-sage/30' : 'bg-paper2 text-ink2 border border-line'
                }`}
              >
                {item}
              </span>
              {i < rest.length - 1 && <span className="text-ink3 text-[10px]">‹</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
