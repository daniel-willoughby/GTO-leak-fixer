// Proves the app can consume a pre-solved node: load JSON, answer a hand,
// and compute the range-wide aggregate the way the trainer would.
// Run: node solver-spike/query.mjs AQs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const node = JSON.parse(readFileSync(join(here, 'sample-flop.json'), 'utf8'))

function query(hand) {
  const freqs = node.strategy[hand]
  if (!freqs) return { hand, found: false }
  let bi = 0
  freqs.forEach((f, i) => (f > freqs[bi] ? (bi = i) : null))
  return { hand, found: true, actions: node.actions, freqs, primary: node.actions[bi] }
}

// Range-wide aggregate: average bet frequency across all stored hands.
function rangeBetFrequency() {
  const betIdx = node.actions.findIndex((a) => a.startsWith('bet'))
  const hands = Object.values(node.strategy)
  const avg = hands.reduce((s, f) => s + f[betIdx], 0) / hands.length
  return avg
}

const hand = process.argv[2] ?? 'AQs'
const r = query(hand)

console.log(`\nSpot: ${node.spot}   Board: ${node.board}   Hero: ${node.hero} facing ${node.facing}`)
console.log(`Sizes: ${node.betSizes.map((b) => `${Math.round(b * 100)}% pot`).join(', ')}\n`)

if (!r.found) {
  console.log(`${hand}: not in stored range (would fold pre / not reach this node).`)
} else {
  const parts = r.actions.map((a, i) => `${a} ${Math.round(r.freqs[i] * 100)}%`)
  console.log(`${hand}:  ${parts.join('   ')}`)
  console.log(`GTO primary action → ${r.primary}  (what the drill scores against)`)
}

console.log(`\nRange c-bets ${Math.round(rangeBetFrequency() * 100)}% of the time on ${node.board}.`)
if (node.meta.approximate) console.log('\n⚠️  approximate placeholder data — see README for the real pipeline.')
