// Spot-check the freshly-solved flop nodes against known GTO heuristics before
// committing to the full batch. Reads the staging corpus written by solve-boards.mjs.
//   node solver-spike/validate.mjs
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const STAGING = join(here, '.street-nodes.staging.json')
if (!existsSync(STAGING)) {
  console.error('no staging file yet — run solve-boards.mjs first')
  process.exit(1)
}
const nodes = JSON.parse(readFileSync(STAGING, 'utf8'))
const flops = nodes.filter((n) => n.street === 'flop')

const RANK = 'AKQJT98765432'
const high = (b) => Math.min(...b.match(/../g).map((c) => RANK.indexOf(c[0])))
const paired = (b) => new Set(b.match(/../g).map((c) => c[0])).size < 3
const mono = (b) => new Set(b.match(/../g).map((c) => c[1])).size === 1

// range-wide mean of each action across the 169 labels present
function profile(f) {
  const rows = Object.values(f.strategy)
  const n = rows.length
  const mean = f.actions.map((_, i) => rows.reduce((s, r) => s + (r[i] ?? 0), 0) / n)
  const bet = mean.slice(1).reduce((a, b) => a + b, 0)
  const bigShare = f.actions.includes('bet75') ? mean[f.actions.indexOf('bet75')] / (bet || 1) : 0
  return { mean, bet, bigShare }
}

// Structural problems must block the pipeline; heuristic oddities are advisory
// only (poker is texture-dependent — e.g. big sizes legitimately dominate on
// monotone boards — so they must never break the validate → finalize chain).
const errors = []
const warnings = []
console.log('board     hi  tex      bet%  small/big  | AA   TPTK(A-x)  air(KQ)')
for (const f of flops) {
  const b = f.board
  const { bet, bigShare } = profile(f)
  const tex = paired(b) ? 'paired' : mono(b) ? 'mono' : high(b) <= RANK.indexOf('T') ? 'high' : 'low/mid'
  const pct = (x) => (x * 100).toFixed(0).padStart(3)
  const sig = (lab) => {
    const r = f.strategy[lab]
    return r ? `${pct(1 - r[0])}%` : ' n/a'
  }
  console.log(
    `${b.padEnd(9)} ${RANK[high(b)]}   ${tex.padEnd(7)} ${pct(bet)}%  ${(bigShare * 100).toFixed(0).padStart(3)}% big | ` +
      `${sig('AA')}  ${sig('AKs')}      ${sig('KQs')}`,
  )
  // structural (fatal): data must be well-formed
  if (f.actions.length !== f.betSizes.length + 1) errors.push(`${b}: actions/betSizes mismatch`)
  for (const [lab, r] of Object.entries(f.strategy)) {
    const sum = r.reduce((a, x) => a + x, 0)
    if (Math.abs(sum - 1) > 0.02) errors.push(`${b}/${lab}: freqs sum ${sum.toFixed(3)}`)
  }
  // heuristic (advisory): catch gross strategy oddities, but never block
  const fAA = f.strategy['AA']
  if (fAA && 1 - fAA[0] < 0.5) warnings.push(`${b}: AA bets only ${((1 - fAA[0]) * 100).toFixed(0)}% (expected high)`)
  if (tex === 'high' && bet < 0.45) warnings.push(`${b}: dry/high board bets only ${(bet * 100).toFixed(0)}% (expected ~range-bet)`)
  // big size legitimately dominates on monotone boards (sizing up to charge flush
  // draws), so only flag a big-size majority on non-monotone textures.
  if (tex !== 'mono' && bigShare > 0.6)
    warnings.push(`${b}: big size is ${(bigShare * 100).toFixed(0)}% of bets (expected minority on non-monotone flops)`)
}

console.log(`\n${flops.length} flop nodes checked.`)
if (warnings.length) {
  console.log(`\nℹ  ${warnings.length} advisory note(s) (non-blocking):`)
  for (const f of warnings.slice(0, 40)) console.log('  - ' + f)
}
if (errors.length) {
  console.log(`\n✗  ${errors.length} structural error(s) — blocking:`)
  for (const f of errors.slice(0, 40)) console.log('  - ' + f)
  process.exit(2)
}
console.log('✓ structural checks pass.')
