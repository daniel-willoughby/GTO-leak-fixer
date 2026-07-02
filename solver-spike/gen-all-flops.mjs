// Generate the COMPLETE set of strategically-distinct flops — all 1755 flop
// classes up to suit isomorphism. This is the principled maximum board set: any
// flop beyond these 1755 is just a suit-relabelled duplicate of one already in
// the list, so the solver (which uses isomorphism) would learn nothing new.
//
//   node solver-spike/gen-all-flops.mjs > /tmp/all-flops.js   # paste over BOARDS
//
// The 30 originals are emitted FIRST with their exact existing strings (so their
// river data still lines up and the resumable run skips the ones already solved);
// the remaining classes are emitted as canonical representatives.

const RANKS = 'AKQJT98765432'.split('')
const SUITS = 's h d c'.split(' ')
const rankIdx = (r) => RANKS.indexOf(r)
const suitIdx = (s) => SUITS.indexOf(s)

// The 30 originals, kept first and unchanged.
const ORIGINAL = [
  'As8c3h', 'Ah7d2c', 'Ad9c4h', 'KsTh5d', 'Kc8d3s', 'Ks9h4c', 'Qs7h2c', 'Qd9c5h', 'Jc8d3h', 'Td7c2s',
  'KsQh7c', 'AsKd9h', 'QsJh8c', 'JsTd6c', '9h8h4c', 'Jd7d2s', 'Ts9s5d', '8d7d3c', '7h6d5c', '6s5h4d',
  '5s4d3h', '9c7d4s', 'Td8c5h', 'AsAd7c', 'KsKh4c', '8s8d3h', '2s2d9h', 'AhKh4h', 'Qs8s4s', 'Th9h6h',
]

const toCards = (b) => b.match(/../g).map((t) => ({ r: t[0], s: t[1] }))
const sortCards = (cards) =>
  [...cards].sort((a, b) => rankIdx(a.r) - rankIdx(b.r) || suitIdx(a.s) - suitIdx(b.s))
const asStr = (cards) => cards.map((c) => c.r + c.s).join('')

// All 24 permutations of the four suits.
function permutations(arr) {
  if (arr.length <= 1) return [arr]
  const out = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permutations(rest)) out.push([arr[i], ...p])
  }
  return out
}
const SUIT_PERMS = permutations(SUITS)

// Canonical key of a flop: the lexicographically smallest string over all suit
// relabellings (ranks fixed). Two flops share a key iff they're isomorphic.
function canonicalKey(cards) {
  let best = null
  for (const perm of SUIT_PERMS) {
    const map = { s: perm[0], h: perm[1], d: perm[2], c: perm[3] }
    const mapped = sortCards(cards.map((c) => ({ r: c.r, s: map[c.s] })))
    const str = asStr(mapped)
    if (best === null || str < best) best = str
  }
  return best
}

const seen = new Set()
const out = []

// Seed with the originals (their canonical class), but emit the ORIGINAL string.
for (const b of ORIGINAL) {
  const key = canonicalKey(toCards(b))
  if (!seen.has(key)) {
    seen.add(key)
    out.push(b)
  }
}

// Enumerate every 3-card combo, dedupe by canonical class, emit the canonical rep.
const deck = []
for (const r of RANKS) for (const s of SUITS) deck.push({ r, s })
for (let i = 0; i < deck.length; i++)
  for (let j = i + 1; j < deck.length; j++)
    for (let k = j + 1; k < deck.length; k++) {
      const cards = [deck[i], deck[j], deck[k]]
      const key = canonicalKey(cards)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(key) // canonical representative string
    }

// Optional even sample: `node gen-all-flops.mjs 400` keeps the 30 originals and
// spreads the remaining picks uniformly across the canonical list (which is
// enumerated in rank order, so an even stride gives a texture cross-section).
const target = Number(process.argv[2]) || out.length
let boards = out
if (target < out.length) {
  const originals = out.slice(0, ORIGINAL.length)
  const rest = out.slice(ORIGINAL.length)
  const need = target - originals.length
  const stride = rest.length / need
  const sampled = []
  for (let i = 0; i < need; i++) sampled.push(rest[Math.floor(i * stride)])
  boards = [...originals, ...sampled]
}

console.error(
  `emitting ${boards.length} of ${out.length} flop classes (${ORIGINAL.length} originals first${
    target < out.length ? ', rest an even texture-spread sample' : ''
  })`,
)
const lines = []
for (let i = 0; i < boards.length; i += 10) lines.push('  ' + boards.slice(i, i + 10).map((b) => `'${b}'`).join(', ') + ',')
console.log('const BOARDS = [\n' + lines.join('\n') + '\n]')
