// Append-only log of major app actions, for debugging and monitoring.
//
// Chasing the "daily leaderboard is broken" report meant guessing at RLS, then
// the Edge Function, then the publish path, when the real cause was the UTC day
// rolling over. A record of what the app actually did (published a score? got
// what back? which day did it ask for?) turns that kind of hunt into reading a
// list, so the events here lean towards the seams: auth, publishing, syncing,
// and anything that talks to the network.
//
// Deliberately local and dependency-free: a capped ring buffer in localStorage,
// synchronous, safe to call from anywhere, and never throws (a logger must not
// be able to break the thing it is logging). Nothing is sent anywhere; the user
// exports it by hand from Settings.

const KEY = 'lt-event-log'
const CAP = 300 // keep the tail; enough for several sessions, ~50KB worst case

export interface AppEvent {
  /** epoch ms */
  t: number
  /** dotted event name, e.g. "daily.publish" */
  type: string
  /** small structured payload; keep it primitive and short */
  detail?: Record<string, unknown>
}

function read(): AppEvent[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Record an action. Never throws and never blocks: a failed write (private
 * mode, quota) silently drops the entry rather than surfacing to the caller.
 */
export function logEvent(type: string, detail?: Record<string, unknown>): void {
  try {
    const events = read()
    events.push({ t: Date.now(), type, ...(detail && Object.keys(detail).length ? { detail } : {}) })
    localStorage.setItem(KEY, JSON.stringify(events.slice(-CAP)))
  } catch {
    /* logging must never break the app */
  }
}

/** Newest first, for display. */
export function getEventLog(): AppEvent[] {
  return read().slice().reverse()
}

export function clearEventLog(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Plain-text dump for copy/paste into a bug report. */
export function formatEventLog(): string {
  const rows = read().map((e) => {
    const stamp = new Date(e.t).toISOString().replace('T', ' ').slice(0, 19)
    const detail = e.detail ? ' ' + JSON.stringify(e.detail) : ''
    return `${stamp}  ${e.type}${detail}`
  })
  return [`PotKing event log (${rows.length} entries, newest last)`, `exported ${new Date().toISOString()}`, '', ...rows].join('\n')
}
