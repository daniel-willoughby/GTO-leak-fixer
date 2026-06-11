// Merge the per-matchup all-seats accumulators into the app's freeplay dataset.
// Run after solve-allseats.mjs has produced .accum-*.json files (any subset is fine
// — it merges whatever's there). Validates frequencies/actions, then installs.
//   node solver-spike/finalize-allseats.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'src', 'data', 'freeplay-nodes.json')
const MATCHUPS = ['UTG_vs_BB', 'HJ_vs_BB', 'CO_vs_BB', 'BTN_vs_BB']

let all = []
for (const id of MATCHUPS) {
  const f = join(here, `.accum-${id}.json`)
  if (!existsSync(f)) {
    console.log(`(skip ${id} — no accum yet)`)
    continue
  }
  const nodes = JSON.parse(readFileSync(f, 'utf8'))
  const by = nodes.reduce((m, n) => ((m[`${n.street}/${n.kind}`] = (m[`${n.street}/${n.kind}`] || 0) + 1), m), {})
  console.log(`${id}: ${nodes.length} nodes`, by)
  all.push(...nodes)
}

if (all.length === 0) {
  console.error('No accum data found — run solve-allseats.mjs first. Leaving freeplay-nodes.json untouched.')
  process.exit(1)
}

// validate: every strategy row sums to ~1 and matches the action count
let bad = 0
const KINDS = new Set(['cbet', 'donk', 'face_cbet'])
for (const n of all) {
  if (!KINDS.has(n.kind)) (console.error(`bad kind ${n.kind} (${n.board})`), bad++)
  if (n.betSizes.length !== (n.actions[0] === 'check' ? n.actions.length - 1 : 0)) {
    console.error(`betSizes/actions mismatch (${n.board} ${n.kind})`)
    bad++
  }
  for (const [lab, fr] of Object.entries(n.strategy)) {
    if (fr.length !== n.actions.length) (console.error(`${n.board}/${lab}: len`), bad++)
    const sum = fr.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1) > 0.03) (console.error(`${n.board}/${lab}: sum ${sum.toFixed(3)}`), bad++)
  }
}
if (bad) {
  console.error(`\n✗ ${bad} validation error(s) — not installing.`)
  process.exit(1)
}

writeFileSync(OUT, JSON.stringify(all) + '\n')
const byKind = all.reduce((m, n) => ((m[n.kind] = (m[n.kind] || 0) + 1), m), {})
console.log(`\n✓ wrote ${all.length} nodes → src/data/freeplay-nodes.json`, byKind)
