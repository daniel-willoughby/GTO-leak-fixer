// From a flop solve dump, derive the ranges that reach the TURN in the
// bet-line (BTN c-bets 33%, BB calls), so we can solve a small turn-rooted
// tree that actually contains river nodes (avoids GB-sized dump_rounds=3).
//
//   IP (BTN) turn range = combos weighted by their flop bet-33 frequency
//   OOP (BB) turn range = combos weighted by their call-vs-cbet frequency
//
// Usage: node extract-turn-ranges.mjs <flop-result.json>
//   prints:  IP_RANGE=...   OOP_RANGE=...
import { readFileSync } from 'node:fs'

const RANKS = 'AKQJT98765432'
const label = (combo) => {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}

// average a per-combo weight up to 169-hand labels → "LABEL:weight" string
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

const tree = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const ipCbet = tree.childrens.CHECK // IP facing BB check (actions: CHECK, BET 2.0, BET allin)
const betKey = ipCbet.strategy.actions.findIndex((a) => a.startsWith('BET'))
const ipWeights = {}
for (const [combo, freqs] of Object.entries(ipCbet.strategy.strategy)) ipWeights[combo] = freqs[betKey]

const oopFacing = ipCbet.childrens['BET 2.000000'] // OOP facing the c-bet (CALL, RAISE..., FOLD)
const callIdx = oopFacing.strategy.actions.indexOf('CALL')
const oopWeights = {}
for (const [combo, freqs] of Object.entries(oopFacing.strategy.strategy)) oopWeights[combo] = freqs[callIdx]

console.log('IP_RANGE=' + rangeString(ipWeights))
console.log('OOP_RANGE=' + rangeString(oopWeights))
