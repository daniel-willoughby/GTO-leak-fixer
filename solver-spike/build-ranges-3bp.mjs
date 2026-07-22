// Expand preflop tokens into TexasSolver range strings for the BTN-vs-BB
// THREE-BET pot: BTN opens, BB 3-bets, BTN calls.
//   OOP (Big Blind)  = BB 3-bet range (the aggressor, out of position)
//   IP  (Button)     = BTN flat-vs-3bet range (the caller, in position)
// BB's 3-bet tokens are copied from src/data/vsRfi.ts (BTN opens, BB defends).
// BTN's continue range is a standard in-position flat vs a BB 3-bet: it 4-bets
// or folds the polar hands and flats the middle (pairs, suited broadways,
// suited connectors, a few suited wheel aces).

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

// BB 3-bet vs BTN open (src/data/vsRfi.ts → BTN raiser, BB hero, threeBet set)
const BB_3BET = [
  '77+', 'A8s+', 'KTs+', 'QTs+', 'JTs', 'ATo+', 'KJo+', 'A2s', 'A3s', 'A4s', 'A5s', 'K9s', 'Q9s',
]
// BTN flat vs a BB 3-bet (in position): 4-bet/fold the polar hands, flat the
// middle. Pairs 22-QQ, suited broadways below AK, suited connectors, some Ax.
const BTN_CALL_V3B = [
  '22-QQ', 'ATs+', 'KTs+', 'QTs+', 'J9s+', 'T8s+', '97s+', '86s+', '76s', '65s', '54s',
  'AQo', 'A4s', 'A3s',
]

console.log('IP_RANGE=' + expand(BTN_CALL_V3B).join(','))
console.log('OOP_RANGE=' + expand(BB_3BET).join(','))
