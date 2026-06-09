// Extract river nodes (BTN facing a BB check on the river) from the
// turn-rooted solves and merge them into src/data/street-nodes.json.
//
//   bet line:     root.CHECK.[BET].CALL.dealcards.<river>.CHECK
//   check-check:  root.CHECK.CHECK.dealcards.<river>.CHECK
//
// Usage: node solver-spike/transform-rivers.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const INSTALL = '/Users/danwilloughby/Documents/Code Projects/TexasSolver/install'
// Where the persistent turn-rooted river dumps (turn_*_result.json, ~650MB) live.
// Override with LEAKTUTOR_TURN_DUMPS to keep them on an external drive (read via
// Node, so paths with spaces — e.g. /Volumes/X9 Pro/… — are fine).
const TURN_DUMP_DIR = process.env.LEAKTUTOR_TURN_DUMPS || INSTALL
const OUT = join(here, '..', 'src', 'data', 'street-nodes.json')

const RANKS = 'AKQJT98765432'
const round = (x) => Math.round(x * 1000) / 1000
const norm = (raw) => raw.replace(/[^AKQJT2-9akqjt2-9shdc]/g, '').slice(0, 2)

function label(combo) {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}
function aggregate(node) {
  const { actions, strategy } = node.strategy
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
  return out
}
const betKey = (n) => Object.keys(n?.childrens ?? {}).find((k) => k.startsWith('BET'))
const spaced = (b6) => b6.match(/../g).join(' ')

function riverNodes(board8, tree) {
  const out = []
  const flop = board8.slice(0, 6)
  const tc = board8.slice(6, 8)
  const ipTurn = tree.childrens?.CHECK // BTN facing BB check on the turn
  if (!ipTurn?.childrens) return out

  const lines = [
    {
      // bet line: BTN bets turn, BB calls
      chance: ipTurn.childrens[betKey(ipTurn)]?.childrens?.CALL,
      hist: ['BB checks', 'BTN bets 3bb', 'BB calls'],
    },
    {
      // check-check line on the turn
      chance: ipTurn.childrens.CHECK,
      hist: ['BB checks', 'BTN checks back'],
    },
  ]
  for (const { chance, hist } of lines) {
    if (!chance?.dealcards) continue
    for (const rawRiver of Object.keys(chance.dealcards).slice(0, 4)) {
      const rc = norm(rawRiver)
      const ipRiver = chance.dealcards[rawRiver]?.childrens?.CHECK
      if (!ipRiver?.strategy) continue
      out.push({
        spot: 'BTN_vs_BB_SRP',
        board: board8 + rc,
        street: 'river',
        heroAction: 'none',
        history: ['BTN opens 2.5bb', 'BB calls', `Flop: ${spaced(flop)}`, 'BB checks', 'BTN bets 1.8bb', 'BB calls', `Turn: ${tc}`, ...hist, `River: ${rc}`],
        potType: 'srp',
        hero: 'BTN',
        villain: 'BB',
        facing: 'check',
        betSizes: [0.33],
        actions: ['check', 'bet33'],
        strategy: aggregate(ipRiver),
        meta: { solver: 'TexasSolver', generatedAt: new Date().toISOString().slice(0, 10), approximate: false },
      })
    }
  }
  return out
}

const existing = JSON.parse(readFileSync(OUT, 'utf8')).filter((n) => n.street !== 'river')
const files = readdirSync(TURN_DUMP_DIR).filter((f) => /^turn_.+_result\.json$/.test(f))
if (files.length === 0) {
  console.error(`No turn_*_result.json found in ${TURN_DUMP_DIR} — river nodes would be dropped. Aborting.`)
  process.exit(1)
}
const rivers = []
for (const f of files) {
  const board8 = f.replace(/^turn_/, '').replace(/_result\.json$/, '')
  const tree = JSON.parse(readFileSync(join(TURN_DUMP_DIR, f), 'utf8'))
  const rn = riverNodes(board8, tree)
  rivers.push(...rn)
  console.log(`  ${board8}: ${rn.length} river nodes`)
}
const all = [...existing, ...rivers].sort((a, b) => a.board.localeCompare(b.board))
writeFileSync(OUT, JSON.stringify(all, null, 2) + '\n')
console.log(`\nmerged ${rivers.length} river nodes → ${all.length} total nodes`)
