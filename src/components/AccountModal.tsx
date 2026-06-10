import { useState } from 'react'
import { X, Cloud, CloudOff, LogOut, RefreshCw, Mail, Check } from 'lucide-react'
import { useAuth } from '../lib/useAuth'

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
  const { user, signIn, signUp, signInWithGoogle, signOut } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      else if (mode === 'up' && !res.data.session) setNotice('Check your email to confirm your account, then sign in.')
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
            <div className="flex items-center gap-2 text-xs text-ink3">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <button
              onClick={() => signInWithGoogle()}
              className="btn btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm"
            >
              <svg width="15" height="15" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-17z" />
                <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-2.9.8-4.3l-7.8-6.1C.9 16.8 0 20.3 0 24s.9 7.2 2.6 10.4l7.8-6.1z" />
                <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.2 2.2-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Continue with Google
            </button>
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink3">
          <CloudOff size={12} /> Everything works offline. Sign in only to back up and sync across devices.
        </p>
      </div>
    </div>
  )
}
