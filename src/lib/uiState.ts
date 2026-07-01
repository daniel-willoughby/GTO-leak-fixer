// Remember where the user was. Small helpers to persist bits of UI position
// (active tab, sub-tab, shop filter, scroll offset) across tab switches and
// reloads, so navigating away and back lands you exactly where you left off.
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/** `useState` that persists to localStorage under `key`, restoring on mount. */
export function useStickyState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }, [key, value])
  return [value, setValue]
}

// Per-tab scroll offsets for the main scroll container, kept in sessionStorage so
// they survive a reload within a session without cluttering long-term storage.
const SCROLL_KEY = 'lt-scroll-pos'

function readScrollMap(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

export function saveScroll(tab: string, offset: number): void {
  const map = readScrollMap()
  map[tab] = offset
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map))
  } catch {
    /* non-fatal */
  }
}

export function loadScroll(tab: string): number {
  return readScrollMap()[tab] ?? 0
}
