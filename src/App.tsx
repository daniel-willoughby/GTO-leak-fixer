import { useState } from 'react'
import DrillScreen from './components/DrillScreen'
import LeaksScreen from './components/LeaksScreen'
import LearnScreen from './components/LearnScreen'

type Tab = 'drill' | 'leaks' | 'learn'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'drill', label: 'Drill', icon: '🎲' },
  { id: 'leaks', label: 'Leaks', icon: '🎯' },
  { id: 'learn', label: 'Learn', icon: '📘' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('drill')
  const [progress, setProgress] = useState(0)

  return (
    <div className="min-h-full flex flex-col">
      <header className="text-center py-3 border-b border-slate-800">
        <h1 className="text-lg font-bold tracking-tight">
          Leak<span className="text-amber-400">Tutor</span>
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === 'drill' && <DrillScreen onProgress={() => setProgress((p) => p + 1)} />}
        {tab === 'leaks' && <LeaksScreen version={progress} />}
        {tab === 'learn' && <LearnScreen />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition ${
              tab === t.id ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
