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
  const marg = nodes.reduce((s, n) => s + (n.marginal ?? 0), 0) / (nodes.length || 1)
  boards.push({
    board: f.replace('.json', ''),
    spot: nodes[0]?.spot ?? 'BTN_vs_BB_SRP',
    potType: nodes[0]?.potType ?? 'srp',
    nodes: nodes.length,
    marginal: Math.round(marg * 1000) / 1000,
    streets,
  })
}
boards.sort((a, b) => a.board.localeCompare(b.board))
writeFileSync(join(DST, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), totalBytes: bytes, boards }))
console.log(`promoted ${boards.length} shards (${(bytes / 1e6).toFixed(1)} MB) -> public/postflop-shards/`)

// ---- web subset ------------------------------------------------------------
// Stratify by matchup, then take the most marginal boards within each. A plain
// alphabetical stride would skew the PWA towards whichever matchup happens to
// sort densely, and now that the corpus spans six matchups the browser build
// should see all of them. Preferring high marginality means the boards that do
// ship are the ones with real decisions on them rather than pure spots.
rmSync(WEB, { recursive: true, force: true })
mkdirSync(WEB, { recursive: true })
const byMatchup = new Map()
for (const b of boards) {
  const arr = byMatchup.get(b.spot) ?? []
  arr.push(b)
  byMatchup.set(b.spot, arr)
}
const perMatchup = Math.max(1, Math.round(WEB_BOARDS / byMatchup.size))
const webBoards = []
for (const [, arr] of byMatchup) {
  arr.sort((a, b) => b.marginal - a.marginal)
  webBoards.push(...arr.slice(0, perMatchup))
}
webBoards.sort((a, b) => a.board.localeCompare(b.board))
let webBytes = 0
for (const b of webBoards) {
  copyFileSync(join(SRC, `${b.board}.json`), join(WEB, `${b.board}.json`))
  webBytes += statSync(join(WEB, `${b.board}.json`)).size
}
writeFileSync(join(WEB, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), totalBytes: webBytes, boards: webBoards }))
console.log(`web subset ${webBoards.length} shards (${(webBytes / 1e6).toFixed(1)} MB) -> public/postflop-shards-web/`)
