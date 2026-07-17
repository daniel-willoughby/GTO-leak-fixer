// Rich postflop corpus loader. The bundled slim corpus (street-nodes.json) is
// always present; this progressively fetches the sharded corpus and folds it
// in, so the drill pool grows without a giant import or up-front parse.
//
// Native gets the FULL corpus (postflop-shards/, ~130MB, bundled in the app).
// The PWA fetches a curated ~30-board subset (postflop-shards-web/, committed
// and deployed) — big enough for real facing-line variety, small enough to
// download in the background. localStorage `lt-shards`: '0' disables on web,
// 'full' points the web at the full corpus (dev server only).
import { Capacitor } from '@capacitor/core'
import { registerNodes, type StreetNode } from './postflop'

interface ShardIndex {
  generatedAt?: string
  boards?: { board: string; nodes?: number }[]
}

const flag = (): string | null => {
  try {
    return localStorage.getItem('lt-shards')
  } catch {
    return null
  }
}
const DIR = Capacitor.isNativePlatform() || flag() === 'full' ? 'postflop-shards/' : 'postflop-shards-web/'
const BASE = `${import.meta.env.BASE_URL}${DIR}`
let started = false

function enabled(): boolean {
  if (Capacitor.isNativePlatform()) return true
  return flag() !== '0'
}

/** Kick off shard loading (fire-and-forget from main.tsx). Safe no-op when the
 *  index is absent, so the app always works on the bundled corpus alone. */
export async function initPostflopShards(): Promise<void> {
  if (started || !enabled()) return
  started = true
  let index: ShardIndex | null = null
  try {
    const res = await fetch(`${BASE}index.json`)
    if (res.ok) index = await res.json()
  } catch {
    /* offline or no shards published — stay on the bundled corpus */
  }
  const boards = index?.boards
  if (!boards?.length) return

  // shuffle so the playable pool broadens evenly as shards trickle in, and load
  // a few at a time to avoid a burst of large fetches on launch
  const queue = [...boards].sort(() => Math.random() - 0.5)
  const BATCH = 4
  for (let i = 0; i < queue.length; i += BATCH) {
    const slice = queue.slice(i, i + BATCH)
    const loaded = await Promise.all(
      slice.map(async (b) => {
        try {
          const res = await fetch(`${BASE}${b.board}.json`)
          return res.ok ? ((await res.json()) as StreetNode[]) : null
        } catch {
          return null
        }
      }),
    )
    for (const nodes of loaded) if (nodes) registerNodes(nodes)
  }
}
