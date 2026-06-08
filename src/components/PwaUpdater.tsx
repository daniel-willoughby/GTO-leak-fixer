import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Shows a small toast when a new build is available, so deployed fixes reach
// installed users without a manual hard-refresh / cache clear.
export default function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      // While the app stays open, check for a new deploy once an hour.
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-sage/40 bg-paper2 px-4 py-3 shadow-xl animate-pop">
        <RefreshCw size={18} className="shrink-0 text-sage" />
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold text-ink">A new version is ready</p>
          <p className="text-xs text-ink2">Refresh to get the latest improvements.</p>
        </div>
        <button onClick={() => updateServiceWorker(true)} className="btn btn-primary px-3 py-1.5 text-sm">
          Refresh
        </button>
        <button onClick={() => setNeedRefresh(false)} aria-label="Dismiss" className="p-1 text-ink3 hover:text-ink">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
