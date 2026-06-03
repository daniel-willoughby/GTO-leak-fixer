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
      <header className="safe-top relative text-center py-3 border-b border-slate-800">
        <h1 className="text-lg font-bold tracking-tight">
          Leak<span className="text-amber-400">Tutor</span>
        </h1>
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === 'drill' && <DrillScreen onProgress={() => setProgress((p) => p + 1)} />}
        {tab === 'leaks' && <LeaksScreen version={progress} />}
        {tab === 'learn' && <LearnScreen />}
      </main>

      <nav className="safe-bottom fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-1 text-xs font-medium transition ${
                active ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
              {t.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
