/** Compact scrollable pill row showing the action history for the current hand. */
export default function HandHistory({ history }: { history: string[] }) {
  if (!history.length) return null
  // Lead with the most recent action so the current decision context is always
  // visible at the left; older events trail off (and scroll) to the right. The
  // back-chevron separators keep the reverse-chronological order readable.
  const items = [...history].reverse()
  return (
    <div className="w-full overflow-x-auto pb-0.5">
      <div className="flex items-center gap-1.5 min-w-max px-1">
        {items.map((item, i) => {
          const isBoard = item.startsWith('Flop:') || item.startsWith('Turn:') || item.startsWith('River:')
          const isAction = item.includes('bets') || item.includes('calls') || item.includes('checks') || item.includes('raises') || item.includes('opens')
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className={[
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
                  isBoard
                    ? 'bg-sage/15 text-sage-dark border border-sage/30'
                    : isAction
                      ? 'bg-paper2 text-ink2 border border-line'
                      : 'bg-clay/10 text-clay border border-clay/25',
                ].join(' ')}
              >
                {item}
              </span>
              {i < items.length - 1 && <span className="text-ink3 text-[10px]">‹</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
