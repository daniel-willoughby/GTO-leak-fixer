// Expand our app's preflop range tokens into explicit TexasSolver range
// strings for the BTN_vs_BB single-raised pot.
//   IP  (Button)      = full BTN open range
//   OOP (Big Blind)   = BB flat-call range vs a BTN open (3-bets excluded —
//                       those don't reach a single-raised pot)
// Token lists are copied from src/data/ranges.ts and src/data/vsRfi.ts.

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const ri = (r) => RANKS.indexOf(r)

function expandToken(token) {
  if (token.includes('-')) {
    const [a, b] = token.split('-')
    const lo = ri(a[0])
    const hi = ri(b[0])
    const [from, to] = lo >= hi ? [hi, lo] : [lo, hi]
    const out = []
    for (let i = from; i <= to; i++) out.push(`${RANKS[i]}${RANKS[i]}`)
    return out
  }
  const plus = token.endsWith('+')
  const t = plus ? token.slice(0, -1) : token
  if (t.length === 2 && t[0] === t[1]) {
    if (!plus) return [t]
    const out = []
    for (let i = ri(t[0]); i >= 0; i--) out.push(`${RANKS[i]}${RANKS[i]}`)
    return out
  }
  const hi = t[0]
  const lo = t[1]
  const suit = t[2]
  if (!plus) return [`${hi}${lo}${suit}`]
  const out = []
  for (let loIdx = ri(lo); loIdx > ri(hi); loIdx--) out.push(`${hi}${RANKS[loIdx]}${suit}`)
  return out
}

const expand = (tokens) => [...new Set(tokens.flatMap(expandToken))]

// BTN RFI open (src/data/ranges.ts)
const BTN_OPEN = [
  '22+', 'A2s+', 'K2s+', 'Q4s+', 'J6s+', 'T6s+', '96s+', '85s+', '74s+', '63s+',
  '53s+', '43s', 'A2o+', 'K8o+', 'Q9o+', 'J9o+', 'T9o', '98o',
]
// BB flat-call vs BTN (src/data/vsRfi.ts → BTN_vs_BB call set)
const BB_CALL = [
  '22-66', 'A2s+', 'K2s+', 'Q5s+', 'J7s+', 'T7s+', '96s+', '85s+', '75s+',
  '64s+', '53s+', 'A2o+', 'K9o+', 'Q9o+', 'J9o+', 'T9o',
]

console.log('IP_RANGE=' + expand(BTN_OPEN).join(','))
console.log('OOP_RANGE=' + expand(BB_CALL).join(','))
