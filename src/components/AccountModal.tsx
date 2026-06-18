import { useState } from 'react'
import { X, Cloud, CloudOff, LogOut, RefreshCw, Mail, Check } from 'lucide-react'
import { useAuth } from '../lib/useAuth'
import { getHandle, setHandle } from '../lib/leaderboard'

interface Props {
  onClose: () => void
  onSyncNow: () => Promise<void>
  syncing: boolean
  lastSynced: number | null
}

function ago(ts: number | null): string {
  if (!ts) return ''
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

export default function AccountModal({ onClose, onSyncNow, syncing, lastSynced }: Props) {
  const { user, signIn, signUp, signOut } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState(getHandle())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const res = mode === 'in' ? await signIn(email, password) : await signUp(email, password)
      if (res.error) setError(res.error.message)
      else if (mode === 'up') {
        // remember the chosen username; published to the leaderboard on first sync
        if (username.trim()) setHandle(username)
        if (!res.data.session) setNotice('Check your email to confirm your account, then sign in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl border border-line bg-paper p-5 shadow-xl sm:rounded-2xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="serif text-xl text-ink flex items-center gap-2">
            <Cloud size={20} className="text-sage" /> Account
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink2 hover:bg-ink/5 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {user ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-sage/30 bg-sage/[0.08] p-3">
              <p className="text-xs uppercase tracking-wide text-ink3">Signed in</p>
              <p className="truncate font-semibold text-ink">{user.email}</p>
            </div>
            <p className="text-sm text-ink2">Your leaks, streak, and lesson progress sync across your devices.</p>
            <button
              onClick={onSyncNow}
              disabled={syncing}
              className="btn btn-primary flex items-center justify-center gap-2 py-3 text-sm disabled:opacity-60"
            >
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            {lastSynced && !syncing && (
              <p className="flex items-center justify-center gap-1 text-xs text-sage-dark">
                <Check size={12} /> Last synced {ago(lastSynced)}
              </p>
            )}
            <button
              onClick={signOut}
              className="btn btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1 rounded-xl border border-line bg-ink/[0.06] p-1 text-sm">
              {(['in', 'up'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m)
                    setError(null)
                    setNotice(null)
                  }}
                  className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                    mode === m ? 'bg-sage text-white' : 'text-ink2 hover:text-ink'
                  }`}
                >
                  {m === 'in' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="flex flex-col gap-2.5">
              {mode === 'up' && (
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username (shown on leaderboards)"
                  maxLength={24}
                  className="rounded-xl border border-line bg-paper2 px-3 py-2.5 text-sm text-ink outline-none focus:border-sage"
                />
              )}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="rounded-xl border border-line bg-paper2 px-3 py-2.5 text-sm text-ink outline-none focus:border-sage"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (6+ characters)"
                className="rounded-xl border border-line bg-paper2 px-3 py-2.5 text-sm text-ink outline-none focus:border-sage"
              />
              {error && <p className="text-xs text-heartred">{error}</p>}
              {notice && (
                <p className="flex items-start gap-1.5 text-xs text-sage-dark">
                  <Mail size={13} className="mt-0.5 shrink-0" /> {notice}
                </p>
              )}
              <button type="submit" disabled={busy} className="btn btn-primary py-3 text-sm disabled:opacity-60">
                {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink3">
          <CloudOff size={12} /> Everything works offline. Sign in only to back up and sync across devices.
        </p>
      </div>
    </div>
  )
}
