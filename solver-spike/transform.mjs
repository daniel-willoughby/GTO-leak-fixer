// Transform a TexasSolver dump into our FlopNode schema.
// Extracts the BTN (IP) c-bet-facing-check node, aggregates per-combo solver
// strategy up to 169-hand labels, and writes solver-spike/sample-flop.json.
//
// Usage: node solver-spike/transform.mjs <path-to-solver-result.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = process.argv[2]
if (!src) {
  console.error('pass the solver result JSON path')
  process.exit(1)
}

const tree = JSON.parse(readFileSync(src, 'utf8'))

// Root = OOP (BB) check/bet. Its CHECK child = IP (BTN) facing a check.
const ipNode = tree.childrens.CHECK
const { actions, strategy } = ipNode.strategy // actions like ["CHECK","BET 2.0","BET 97.0"]

const betIdxs = actions.map((a, i) => (a.startsWith('BET') || a.startsWith('RAISE') ? i : -1)).filter((i) => i >= 0)
const checkIdx = actions.indexOf('CHECK')

const RANKS = 'AKQJT98765432'
function label(combo) {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}

// Aggregate per-combo [check, bet] up to 169-label means.
const acc = new Map() // label -> { check, bet, n }
for (const [combo, freqs] of Object.entries(strategy)) {
  const bet = betIdxs.reduce((s, i) => s + freqs[i], 0)
  const check = freqs[checkIdx]
  const lab = label(combo)
  const cur = acc.get(lab) ?? { check: 0, bet: 0, n: 0 }
  cur.check += check
  cur.bet += bet
  cur.n += 1
  acc.set(lab, cur)
}

const round = (x) => Math.round(x * 1000) / 1000
const outStrategy = {}
for (const [lab, v] of acc) outStrategy[lab] = [round(v.check / v.n), round(v.bet / v.n)]

const node = {
  spot: 'BTN_vs_BB_SRP',
  board: 'Qs7h2c',
  potType: 'srp',
  hero: 'BTN',
  facing: 'check',
  betSizes: [0.33],
  actions: ['check', 'bet33'],
  strategy: outStrategy,
  meta: {
    solver: 'TexasSolver (console)',
    iterations: 120,
    exploitability: '4.06% pot',
    generatedAt: new Date().toISOString().slice(0, 10),
    approximate: false,
  },
}

const dest = join(here, 'sample-flop.json')
writeFileSync(dest, JSON.stringify(node, null, 2) + '\n')
console.log(`wrote ${dest}`)
console.log(`labels: ${Object.keys(outStrategy).length}`)
const betFreq = Object.values(outStrategy).reduce((s, f) => s + f[1], 0) / Object.keys(outStrategy).length
console.log(`range c-bet frequency: ${Math.round(betFreq * 100)}%`)
