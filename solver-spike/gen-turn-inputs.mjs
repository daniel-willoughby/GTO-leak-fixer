// Generate turn-rooted solve inputs (turn + river) for a few turn cards per
// flop, seeded with the ranges that reach the turn in the c-bet-called line.
// Writes turn_<board8>.txt into the TexasSolver install dir.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const INSTALL = '/Users/danwilloughby/Documents/Code Projects/TexasSolver/install'
const RANKS = 'AKQJT98765432'

const label = (combo) => {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}
function rangeString(weights) {
  const acc = new Map()
  for (const [combo, w] of Object.entries(weights)) {
    const k = label(combo)
    const cur = acc.get(k) ?? { sum: 0, n: 0 }
    cur.sum += w
    cur.n += 1
    acc.set(k, cur)
  }
  const parts = []
  for (const [k, v] of acc) {
    const w = v.sum / v.n
    if (w >= 0.02) parts.push(`${k}:${Math.round(w * 1000) / 1000}`)
  }
  return parts.join(',')
}
function turnRanges(file) {
  const tree = JSON.parse(readFileSync(file, 'utf8'))
  const ipCbet = tree.childrens.CHECK
  const betIdx = ipCbet.strategy.actions.findIndex((a) => a.startsWith('BET'))
  const ip = {}
  for (const [c, f] of Object.entries(ipCbet.strategy.strategy)) ip[c] = f[betIdx]
  const oopFacing = ipCbet.childrens['BET 2.000000']
  const callIdx = oopFacing.strategy.actions.indexOf('CALL')
  const oop = {}
  for (const [c, f] of Object.entries(oopFacing.strategy.strategy)) oop[c] = f[callIdx]
  return { ip: rangeString(ip), oop: rangeString(oop) }
}

const FLOPS = {
  Qs7h2c: 'btn_vs_bb_Qs7h2c_result.json',
  As8c3h: 'board_As8c3h_result.json',
  KsTh5d: 'board_KsTh5d_result.json',
  '9h8h4c': 'board_9h8h4c_result.json',
  Jd7d2s: 'board_Jd7d2s_result.json',
}

// turn boards already present in street-nodes.json → chain cleanly with them
const nodes = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'street-nodes.json'), 'utf8'))
const turnsByFlop = {}
for (const n of nodes) {
  if (n.street !== 'turn') continue
  const flop = n.board.slice(0, 6)
  const tc = n.board.slice(6, 8)
  ;(turnsByFlop[flop] ??= new Set()).add(tc)
}

const comma3 = (flop) => `${flop.slice(0, 2)},${flop.slice(2, 4)},${flop.slice(4, 6)}`
const inputs = []

for (const [flop, file] of Object.entries(FLOPS)) {
  const { ip, oop } = turnRanges(join(INSTALL, file))
  const turns = [...(turnsByFlop[flop] ?? [])].slice(0, 3) // up to 3 turns per flop
  for (const tc of turns) {
    const board8 = flop + tc
    const out = `turn_${board8}.txt`
    const dump = `turn_${board8}_result.json`
    const cfg = `set_pot 9.1
set_effective_stack 95.7
set_board ${comma3(flop)},${tc}
set_range_ip ${ip}
set_range_oop ${oop}
set_bet_sizes oop,turn,bet,33
set_bet_sizes oop,turn,raise,75
set_bet_sizes oop,turn,allin
set_bet_sizes ip,turn,bet,33
set_bet_sizes ip,turn,raise,75
set_bet_sizes ip,turn,allin
set_bet_sizes oop,river,bet,33
set_bet_sizes oop,river,raise,75
set_bet_sizes oop,river,allin
set_bet_sizes ip,river,bet,33
set_bet_sizes ip,river,raise,75
set_bet_sizes ip,river,allin
set_allin_threshold 0.67
build_tree
set_thread_num 8
set_accuracy 0.5
set_max_iteration 80
set_print_interval 30
set_use_isomorphism 1
start_solve
set_dump_rounds 2
dump_result ${dump}
`
    writeFileSync(join(INSTALL, out), cfg)
    inputs.push(out)
  }
}
console.log(inputs.join('\n'))
