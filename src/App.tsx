import { useState } from 'react'
import { Spade, Target, GraduationCap, Volume2, VolumeX, type LucideIcon } from 'lucide-react'
import DrillScreen from './components/DrillScreen'
import LeaksScreen from './components/LeaksScreen'
import LearnScreen from './components/LearnScreen'
import { isMuted, setMuted } from './lib/sound'

type Tab = 'drill' | 'leaks' | 'learn'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'drill', label: 'Drill', icon: Spade },
  { id: 'leaks', label: 'Leaks', icon: Target },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('drill')
  const [progress, setProgress] = useState(0)
  const [muted, setMutedState] = useState(isMuted())

  function toggleMute() {
    const v = !muted
    setMuted(v)
    setMutedState(v)
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="safe-top sticky top-0 z-30 relative text-center py-3 border-b border-white/[0.07] bg-[#090d18]/80 backdrop-blur-md">
        <h1 className="text-lg font-extrabold tracking-tight flex items-center justify-center gap-1.5">
          <Spade size={16} className="text-amber-400 -mt-0.5" fill="currentColor" />
          <span>
            Leak<span className="gold-text">Tutor</span>
          </span>
        </h1>
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === 'drill' && <DrillScreen onProgress={() => setProgress((p) => p + 1)} />}
        {tab === 'leaks' && <LeaksScreen version={progress} />}
        {tab === 'learn' && <LearnScreen />}
      </main>

      <nav className="safe-bottom fixed bottom-0 inset-x-0 z-30 bg-[#0b1020]/90 backdrop-blur-xl border-t border-white/[0.07] flex">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 py-2.5 flex flex-col items-center gap-1 text-xs font-medium transition ${
                active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 shadow-[0_0_10px_rgba(245,196,81,0.7)]" />
              )}
              <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
              {t.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
