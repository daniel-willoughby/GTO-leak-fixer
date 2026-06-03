/** Compact scrollable pill row showing the action history for the current hand. */
export default function HandHistory({ history }: { history: string[] }) {
  if (!history.length) return null
  return (
    <div className="w-full overflow-x-auto pb-0.5">
      <div className="flex items-center gap-1.5 min-w-max px-1">
        {history.map((item, i) => {
          const isBoard = item.startsWith('Flop:') || item.startsWith('Turn:') || item.startsWith('River:')
          const isAction = item.includes('bets') || item.includes('calls') || item.includes('checks') || item.includes('raises') || item.includes('opens')
          return (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className={[
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
                  isBoard
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : isAction
                      ? 'bg-white/5 text-slate-300 border border-white/10'
                      : 'bg-amber-400/10 text-amber-300 border border-amber-400/20',
                ].join(' ')}
              >
                {item}
              </span>
              {i < history.length - 1 && (
                <span className="text-slate-600 text-[10px]">›</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
