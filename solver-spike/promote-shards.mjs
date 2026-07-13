// Publish the solved rich shards to the app: copy solver-spike/shards/*.json
// into public/postflop-shards/ (fetched at runtime by the native app) and write
// a fresh index.json. Re-runnable as more boards finish solving.
//
//   node solver-spike/promote-shards.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, 'shards')
const DST = join(here, '..', 'public', 'postflop-shards')
mkdirSync(DST, { recursive: true })

const files = readdirSync(SRC).filter((f) => f.endsWith('.json') && f !== 'index.json')
const boards = []
let bytes = 0
for (const f of files) {
  const nodes = JSON.parse(readFileSync(join(SRC, f), 'utf8'))
  copyFileSync(join(SRC, f), join(DST, f))
  const size = statSync(join(DST, f)).size
  bytes += size
  const streets = nodes.reduce((m, n) => ((m[n.street] = (m[n.street] || 0) + 1), m), {})
  boards.push({ board: f.replace('.json', ''), nodes: nodes.length, streets })
}
boards.sort((a, b) => a.board.localeCompare(b.board))
writeFileSync(join(DST, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), totalBytes: bytes, boards }))
console.log(`promoted ${boards.length} shards (${(bytes / 1e6).toFixed(1)} MB) -> public/postflop-shards/`)
