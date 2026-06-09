// Promote the staged flop+turn corpus to the live dataset, then re-add river
// continuation for the boards that have turn-rooted dumps (transform-rivers.mjs).
//   node solver-spike/finalize.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const STAGING = join(here, '.street-nodes.staging.json')
const OUT = join(here, '..', 'src', 'data', 'street-nodes.json')

if (!existsSync(STAGING)) {
  console.error('No staging file. Run solve-boards.mjs first.')
  process.exit(1)
}
const staged = JSON.parse(readFileSync(STAGING, 'utf8'))
const by = staged.reduce((m, n) => ((m[n.street] = (m[n.street] || 0) + 1), m), {})
console.log(`staged: ${staged.length} nodes`, by)
writeFileSync(OUT, JSON.stringify(staged, null, 2) + '\n')
console.log('→ wrote src/data/street-nodes.json (flop + turn)')

// Re-add river nodes from the turn-rooted dumps (BTN_vs_BB_SRP, single ⅓ size).
console.log('→ running transform-rivers.mjs to add river continuation…')
execSync('node ' + JSON.stringify(join(here, 'transform-rivers.mjs')), { stdio: 'inherit' })
const final = JSON.parse(readFileSync(OUT, 'utf8'))
const fby = final.reduce((m, n) => ((m[n.street] = (m[n.street] || 0) + 1), m), {})
console.log(`\n✓ final corpus: ${final.length} nodes`, fby)
