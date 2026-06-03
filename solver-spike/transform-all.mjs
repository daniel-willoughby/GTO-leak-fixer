// Transform every TexasSolver result in the install dir into one FlopNode
// array the app consumes (src/data/flop-nodes.json). Each result's BTN
// c-bet-facing-check node is extracted and aggregated to 169-hand labels.
//
// Usage: node solver-spike/transform-all.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const INSTALL = '/Users/danwilloughby/Documents/Code Projects/TexasSolver/install'
const OUT = join(here, '..', 'src', 'data', 'flop-nodes.json')

const RANKS = 'AKQJT98765432'
const round = (x) => Math.round(x * 1000) / 1000

function label(combo) {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}

function boardFromFile(name) {
  const m = name.match(/((?:[AKQJT2-9][shdc]){3})_result\.json$/)
  return m ? m[1] : null
}

function toNode(board, tree) {
  const ip = tree.childrens.CHECK // root = OOP check/bet; CHECK child = BTN facing check
  const { actions, strategy } = ip.strategy
  const betIdxs = actions.map((a, i) => (a.startsWith('BET') || a.startsWith('RAISE') ? i : -1)).filter((i) => i >= 0)
  const checkIdx = actions.indexOf('CHECK')

  const acc = new Map()
  for (const [combo, freqs] of Object.entries(strategy)) {
    const bet = betIdxs.reduce((s, i) => s + freqs[i], 0)
    const lab = label(combo)
    const cur = acc.get(lab) ?? { check: 0, bet: 0, n: 0 }
    cur.check += freqs[checkIdx]
    cur.bet += bet
    cur.n += 1
    acc.set(lab, cur)
  }
  const out = {}
  for (const [lab, v] of acc) out[lab] = [round(v.check / v.n), round(v.bet / v.n)]

  return {
    spot: 'BTN_vs_BB_SRP',
    board,
    potType: 'srp',
    hero: 'BTN',
    facing: 'check',
    betSizes: [0.33],
    actions: ['check', 'bet33'],
    strategy: out,
    meta: {
      solver: 'TexasSolver (console)',
      iterations: 90,
      exploitability: '~5% pot',
      generatedAt: new Date().toISOString().slice(0, 10),
      approximate: false,
    },
  }
}

const files = readdirSync(INSTALL).filter((f) => f.endsWith('_result.json') && boardFromFile(f))
const nodes = []
for (const f of files) {
  const board = boardFromFile(f)
  const tree = JSON.parse(readFileSync(join(INSTALL, f), 'utf8'))
  nodes.push(toNode(board, tree))
  console.log(`  ${board}: ${Object.keys(nodes.at(-1).strategy).length} hands`)
}
nodes.sort((a, b) => a.board.localeCompare(b.board))
writeFileSync(OUT, JSON.stringify(nodes, null, 2) + '\n')
console.log(`wrote ${nodes.length} board(s) → ${OUT}`)
