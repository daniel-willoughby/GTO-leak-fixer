// Publish the solved rich shards to the app: copy solver-spike/shards/*.json
// into public/postflop-shards/ (the FULL corpus, gitignored, bundled into the
// native app) and write a fresh index.json. Also writes a curated ~30-board
// subset to public/postflop-shards-web/ (COMMITTED, deployed to GitHub Pages)
// that the PWA fetches at runtime — the full 130MB is too heavy for the repo
// and for a browser download. Re-runnable as more boards finish solving.
//
//   node solver-spike/promote-shards.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, copyFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, 'shards')
const DST = join(here, '..', 'public', 'postflop-shards')
const WEB = join(here, '..', 'public', 'postflop-shards-web')
const WEB_BOARDS = 30
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

// ---- web subset: every Nth board of the sorted list, for texture variety ----
rmSync(WEB, { recursive: true, force: true })
mkdirSync(WEB, { recursive: true })
const step = Math.max(1, Math.floor(boards.length / WEB_BOARDS))
const webBoards = boards.filter((_, i) => i % step === 0).slice(0, WEB_BOARDS)
let webBytes = 0
for (const b of webBoards) {
  copyFileSync(join(SRC, `${b.board}.json`), join(WEB, `${b.board}.json`))
  webBytes += statSync(join(WEB, `${b.board}.json`)).size
}
writeFileSync(join(WEB, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), totalBytes: webBytes, boards: webBoards }))
console.log(`web subset ${webBoards.length} shards (${(webBytes / 1e6).toFixed(1)} MB) -> public/postflop-shards-web/`)
