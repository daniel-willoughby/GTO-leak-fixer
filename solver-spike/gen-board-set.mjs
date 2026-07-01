// Generate a texture-balanced ~150-board set for the enlarged low-power solve.
// The original 30 boards come FIRST (so their existing river data still lines up
// in finalize), then ~120 new ones spread across texture buckets. Deterministic
// (seeded), deduped, and suit-canonical, so the list is stable and reviewable.
//
//   node solver-spike/gen-board-set.mjs          # prints the JS array literal
//
// Paste the output over the BOARDS array in solve-boards.mjs.

const RANKS = 'AKQJT98765432'.split('')
const SUITS = 'shdc'.split('')

// The 30 originals, kept first and unchanged.
const ORIGINAL = [
  'As8c3h', 'Ah7d2c', 'Ad9c4h', 'KsTh5d', 'Kc8d3s', 'Ks9h4c', 'Qs7h2c', 'Qd9c5h', 'Jc8d3h', 'Td7c2s',
  'KsQh7c', 'AsKd9h', 'QsJh8c', 'JsTd6c',
  '9h8h4c', 'Jd7d2s', 'Ts9s5d', '8d7d3c', '7h6d5c', '6s5h4d', '5s4d3h', '9c7d4s', 'Td8c5h',
  'AsAd7c', 'KsKh4c', '8s8d3h', '2s2d9h',
  'AhKh4h', 'Qs8s4s', 'Th9h6h',
]

// Small seeded PRNG so the generated set is identical on every run.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260702)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const ri = (n) => Math.floor(rnd() * n)

const rankIdx = (r) => RANKS.indexOf(r)
const canonKey = (cards) => cards.map((c) => c.r + c.s).join('')

// Normalise a 3-card board to a canonical suit pattern so we don't emit two
// boards that are isomorphic (the solver uses isomorphism anyway, but a clean
// list avoids wasted solves). Sort by rank desc, then relabel suits in order of
// first appearance to s,h,d,c.
function canonical(cards) {
  const sorted = [...cards].sort((a, b) => rankIdx(a.r) - rankIdx(b.r))
  const map = {}
  let next = 0
  for (const c of sorted) if (!(c.s in map)) map[c.s] = SUITS[next++]
  return sorted.map((c) => ({ r: c.r, s: map[c.s] }))
}

// Distinct random ranks (allowing a controlled number of pairs/trips per texture).
function randRanks({ pairs = 0 } = {}) {
  // pairs: 0 = all distinct, 1 = one pair + kicker, 2 = trips
  if (pairs === 2) {
    const r = pick(RANKS)
    return [r, r, r]
  }
  if (pairs === 1) {
    const r = pick(RANKS)
    let k
    do { k = pick(RANKS) } while (k === r)
    return [r, r, k]
  }
  const set = new Set()
  while (set.size < 3) set.add(pick(RANKS))
  return [...set]
}

// Suit patterns by tone.
function suitsFor(tone) {
  if (tone === 'mono') { const s = pick(SUITS); return [s, s, s] }
  if (tone === 'two') { // two of one suit + one other
    const a = pick(SUITS); let b; do { b = pick(SUITS) } while (b === a)
    const pat = [a, a, b]
    // shuffle which card is offsuit
    for (let i = pat.length - 1; i > 0; i--) { const j = ri(i + 1);[pat[i], pat[j]] = [pat[j], pat[i]] }
    return pat
  }
  // rainbow: three distinct suits
  const s = [...SUITS]; for (let i = s.length - 1; i > 0; i--) { const j = ri(i + 1);[s[i], s[j]] = [s[j], s[i]] }
  return s.slice(0, 3)
}

const seen = new Set(ORIGINAL.map((b) => canonKey(canonical(b.match(/../g).map((t) => ({ r: t[0], s: t[1] }))))))
const out = []

function tryAdd({ pairs = 0, tone = 'rain', filter }) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const ranks = randRanks({ pairs })
    if (filter && !filter(ranks)) continue
    let suits = suitsFor(tone)
    // paired boards can't be monotone across the pair sensibly; keep pair offsuit
    if (pairs >= 1 && tone === 'mono') suits = suitsFor('two')
    const cards = ranks.map((r, i) => ({ r, s: suits[i % suits.length] }))
    // guard against accidental 4-of-suit impossibility is n/a (only 3 cards)
    const canon = canonical(cards)
    const key = canonKey(canon)
    if (seen.has(key)) continue
    // reject an exact card dup within the board (same rank+suit twice)
    if (new Set(canon.map((c) => c.r + c.s)).size !== 3) continue
    seen.add(key)
    out.push(canon.map((c) => c.r + c.s).join(''))
    return true
  }
  return false
}

const has = (ranks, r) => ranks.includes(r)
const broadway = (r) => 'AKQJT'.includes(r)
const low = (r) => '2345678'.includes(r)

// Texture quotas for the ~120 new boards.
const PLAN = [
  // [count, opts, label]
  [16, { tone: 'rain', filter: (r) => has(r, 'A') && r.filter(low).length >= 1 }], // ace-high dry rainbow
  [12, { tone: 'rain', filter: (r) => has(r, 'K') || has(r, 'Q') }],               // king/queen-high
  [14, { tone: 'rain', filter: (r) => r.filter(broadway).length >= 2 }],           // broadway-heavy
  [14, { tone: 'two', filter: (r) => r.filter((x) => 'JT98765'.includes(x)).length >= 2 }], // two-tone connected mid
  [12, { tone: 'two', filter: (r) => r.filter(low).length >= 2 }],                 // two-tone low
  [12, { tone: 'rain', filter: (r) => r.every((x) => 'T98765432'.includes(x)) }],  // low/mid rainbow
  [10, { pairs: 1, tone: 'rain' }],                                                // paired
  [4,  { pairs: 2, tone: 'rain' }],                                                // trips
  [10, { tone: 'mono' }],                                                          // monotone
  [16, { tone: 'rain' }],                                                          // misc rainbow spread
]

for (const [count, opts] of PLAN) {
  let made = 0
  for (let i = 0; i < count * 4 && made < count; i++) if (tryAdd(opts)) made++
}

const all = [...ORIGINAL, ...out]
// Emit as a JS array literal, 10 per line, for pasting into solve-boards.mjs.
const lines = []
for (let i = 0; i < all.length; i += 10) lines.push('  ' + all.slice(i, i + 10).map((b) => `'${b}'`).join(', ') + ',')
console.error(`total ${all.length} boards (${ORIGINAL.length} original + ${out.length} new)`)
console.log('const BOARDS = [\n' + lines.join('\n') + '\n]')
