import { useEffect, useRef, useState } from 'react'
import { Spade, Target, GraduationCap, BookOpen, FileText, Volume2, VolumeX, SlidersHorizontal, Cloud, type LucideIcon } from 'lucide-react'
import DrillScreen from './components/DrillScreen'
import LessonsScreen from './components/LessonsScreen'
import OnboardingScreen from './components/OnboardingScreen'
import LeaksScreen from './components/LeaksScreen'
import LearnScreen from './components/LearnScreen'
import ImportScreen from './components/ImportScreen'
import AccountModal from './components/AccountModal'
import PwaUpdater from './components/PwaUpdater'
import { isMuted, setMuted } from './lib/sound'
import { getLevel, setLevel, type Level } from './lib/level'
import { supabaseConfigured } from './lib/supabase'
import { useAuth } from './lib/useAuth'
import { syncNow, pushLocal } from './lib/sync'
import type { Difficulty, FocusRequest } from './lib/spot'

type Tab = 'drill' | 'lessons' | 'leaks' | 'import' | 'learn'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'drill', label: 'Drill', icon: Spade },
  { id: 'lessons', label: 'Lessons', icon: GraduationCap },
  { id: 'leaks', label: 'Leaks', icon: Target },
  { id: 'import', label: 'Import', icon: FileText },
  { id: 'learn', label: 'Glossary', icon: BookOpen },
]

const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: 'easy', label: 'Easy', note: 'Clear-cut decisions' },
  { id: 'all', label: 'All', note: 'Everything' },
  { id: 'hard', label: 'Hard', note: 'Borderline spots' },
]

type Theme = 'light' | 'dark' | 'auto'
const THEMES: Theme[] = ['light', 'auto', 'dark']

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export default function App() {
  const [tab, setTab] = useState<Tab>('drill')
  const [progress, setProgress] = useState(0)
  const [muted, setMutedState] = useState(isMuted())
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem('lt-difficulty') as Difficulty) || 'all',
  )
  const [level, setLevelState] = useState<Level | null>(() => getLevel())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('lt-theme') as Theme) || 'auto')

  // apply on change + follow the OS while in auto
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  function pickTheme(t: Theme) {
    setTheme(t)
    localStorage.setItem('lt-theme', t)
  }
  // cloud sync (optional, only when Supabase is configured)
  const { user } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<number | null>(null)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleSyncNow() {
    if (!user) return
    setSyncing(true)
    try {
      await syncNow(user.id)
      setLastSynced(Date.now())
      setProgress((p) => p + 1) // refresh screens that read merged data
    } finally {
      setSyncing(false)
    }
  }

  // pull + merge on sign-in
  useEffect(() => {
    if (user) handleSyncNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // debounced background push after activity
  useEffect(() => {
    if (!user) return
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      pushLocal(user.id).then(() => setLastSynced(Date.now()))
    }, 4000)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, user?.id])

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

  function pickLevel(l: Level) {
    setLevel(l)
    setLevelState(l)
    setSettingsOpen(false)
  }

  if (!level) return <OnboardingScreen onPick={pickLevel} />

  function drillLeaks(req: FocusRequest) {
    // new object identity each time so the DrillScreen effect always re-fires
    setFocusRequest({ ...req })
    setTab('drill')
  }

  function openLesson(lessonId: string) {
    setOpenLessonId(lessonId)
    setTab('lessons')
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="safe-top sticky top-0 z-30 relative text-center py-3 border-b border-line bg-paper/80 backdrop-blur-md">
        <h1 className="serif text-xl font-semibold flex items-center justify-center gap-1">
          Leak<span className="text-sage">·</span>Tutor
        </h1>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {supabaseConfigured && (
            <button
              onClick={() => setAccountOpen(true)}
              aria-label="Account"
              className={`relative p-2 rounded-lg transition ${user ? 'text-sage' : 'text-ink2 hover:text-ink hover:bg-ink/5'}`}
            >
              <Cloud size={18} />
              {user && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-sage" />}
            </button>
          )}
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Settings"
            className={`p-2 rounded-lg transition ${settingsOpen ? 'text-sage bg-ink/5' : 'text-ink2 hover:text-ink hover:bg-ink/5'}`}
          >
            <SlidersHorizontal size={18} />
          </button>
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="p-2 rounded-lg text-ink2 hover:text-ink hover:bg-ink/5 transition"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {settingsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
            <div className="absolute right-3 top-full mt-1 z-50 w-60 rounded-2xl border border-line bg-paper2 shadow-xl p-3 text-left">
              <p className="text-xs uppercase tracking-wide text-ink3 mb-2">Experience</p>
              <div className="flex gap-1 mb-3 p-1 rounded-xl bg-ink/[0.06] border border-line">
                {(['beginner', 'intermediate'] as Level[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => pickLevel(l)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition ${
                      level === l ? 'bg-sage text-white' : 'text-ink2 hover:text-ink'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-xs uppercase tracking-wide text-ink3 mb-2">Theme</p>
              <div className="flex gap-1 mb-3 p-1 rounded-xl bg-ink/[0.06] border border-line">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => pickTheme(t)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize transition ${
                      theme === t ? 'bg-sage text-white dark:text-paper' : 'text-ink2 hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-xs uppercase tracking-wide text-ink3 mb-2">Difficulty</p>
              <div className="flex flex-col gap-1">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => pickDifficulty(d.id)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                      difficulty === d.id ? 'bg-sage/15 text-sage-dark' : 'text-ink hover:bg-ink/5'
                    }`}
                  >
                    <span className="font-semibold">{d.label}</span>
                    <span className="text-xs text-ink3">{d.note}</span>
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
            level={level}
            onProgress={() => setProgress((p) => p + 1)}
            requestFocus={focusRequest}
            onFocusConsumed={() => setFocusRequest(null)}
            difficulty={difficulty}
          />
        )}
        {tab === 'lessons' && (
          <LessonsScreen
            onProgress={() => setProgress((p) => p + 1)}
            openLessonId={openLessonId}
            onOpened={() => setOpenLessonId(null)}
          />
        )}
        {tab === 'leaks' && <LeaksScreen version={progress} onDrillLeaks={drillLeaks} onOpenLesson={openLesson} />}
        {tab === 'import' && <ImportScreen onDrillLeaks={drillLeaks} />}
        {tab === 'learn' && <LearnScreen />}
      </main>

      <nav className="safe-bottom fixed bottom-0 inset-x-0 z-30 bg-paper/90 backdrop-blur-xl border-t border-line flex sm:inset-x-auto sm:left-1/2 sm:bottom-5 sm:-translate-x-1/2 sm:w-[26rem] sm:rounded-2xl sm:border sm:px-1 sm:shadow-[0_12px_34px_-14px_rgba(34,31,25,0.4)]">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 py-2.5 flex flex-col items-center gap-1 text-xs transition ${
                active ? 'text-ink font-semibold' : 'text-ink3 hover:text-ink2'
              }`}
            >
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-sage" />}
              <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
              {t.label}
            </button>
          )
        })}
      </nav>

      {accountOpen && (
        <AccountModal
          onClose={() => setAccountOpen(false)}
          onSyncNow={handleSyncNow}
          syncing={syncing}
          lastSynced={lastSynced}
        />
      )}

      <PwaUpdater />
    </div>
  )
}
