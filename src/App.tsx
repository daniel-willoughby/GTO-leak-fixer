import { useState } from 'react'
import { Spade, Target, GraduationCap, FileText, Volume2, VolumeX, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import DrillScreen from './components/DrillScreen'
import LeaksScreen from './components/LeaksScreen'
import LearnScreen from './components/LearnScreen'
import ImportScreen from './components/ImportScreen'
import { isMuted, setMuted } from './lib/sound'
import type { Difficulty, HandCategory } from './lib/spot'

type Tab = 'drill' | 'leaks' | 'import' | 'learn'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'drill', label: 'Drill', icon: Spade },
  { id: 'leaks', label: 'Leaks', icon: Target },
  { id: 'import', label: 'Import', icon: FileText },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
]

const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: 'easy', label: 'Easy', note: 'Clear-cut decisions' },
  { id: 'all', label: 'All', note: 'Everything' },
  { id: 'hard', label: 'Hard', note: 'Borderline spots' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('drill')
  const [progress, setProgress] = useState(0)
  const [muted, setMutedState] = useState(isMuted())
  const [focusRequest, setFocusRequest] = useState<HandCategory[] | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem('lt-difficulty') as Difficulty) || 'all',
  )
  const [settingsOpen, setSettingsOpen] = useState(false)

  function toggleMute() {
    const v = !muted
    setMuted(v)
    setMutedState(v)
  }

  function pickDifficulty(d: Difficulty) {
    setDifficulty(d)
    localStorage.setItem('lt-difficulty', d)
    setSettingsOpen(false)
  }

  function drillLeaks(cats: HandCategory[]) {
    setFocusRequest(cats)
    setTab('drill')
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
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Settings"
            className={`p-2 rounded-lg transition ${settingsOpen ? 'text-amber-400 bg-white/5' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
          >
            <SlidersHorizontal size={18} />
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {settingsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
            <div className="absolute right-3 top-full mt-1 z-50 w-60 rounded-2xl border border-white/10 bg-[#11151f] shadow-2xl p-3 text-left">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Difficulty</p>
              <div className="flex flex-col gap-1">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => pickDifficulty(d.id)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                      difficulty === d.id ? 'bg-amber-500/20 text-amber-200' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="font-semibold">{d.label}</span>
                    <span className="text-xs text-slate-500">{d.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === 'drill' && (
          <DrillScreen
            onProgress={() => setProgress((p) => p + 1)}
            requestFocus={focusRequest}
            onFocusConsumed={() => setFocusRequest(null)}
            difficulty={difficulty}
          />
        )}
        {tab === 'leaks' && <LeaksScreen version={progress} />}
        {tab === 'import' && <ImportScreen onDrillLeaks={drillLeaks} />}
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
