// Expand preflop tokens into TexasSolver IP/OOP range strings for a given
// single-raised-pot MATCHUP (env MATCHUP). Postflop the blinds act first, so
// vs an opener the BB is OOP and the opener is IP; in a blind battle (SB opens,
// BB calls) the SB is OOP and the BB is IP. Tokens are copied from
// src/data/ranges.ts (RFI) and src/data/vsRfi.ts (BB flat-call vs each raiser).
//   node build-ranges-matchup.mjs   with MATCHUP=co_bb|hj_bb|utg_bb|sb_bb|btn_bb

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
const expand = (tokens) => [...new Set(tokens.flatMap(expandToken))].join(',')

// RFI opens (src/data/ranges.ts)
const OPEN = {
  UTG: ['22+', 'A2s+', 'KTs+', 'QTs+', 'J9s+', 'T9s', '98s', '87s', '76s', '65s', 'ATo+', 'KJo+', 'QJo'],
  HJ: ['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T8s+', '97s+', '86s+', '75s+', '65s', '54s', 'A9o+', 'KTo+', 'QTo+', 'JTo'],
  CO: ['22+', 'A2s+', 'K7s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '86s+', '75s+', '64s+', '54s', 'A7o+', 'KTo+', 'QTo+', 'JTo', 'T9o'],
  BTN: ['22+', 'A2s+', 'K2s+', 'Q4s+', 'J6s+', 'T6s+', '96s+', '85s+', '74s+', '63s+', '53s+', '43s', 'A2o+', 'K8o+', 'Q9o+', 'J9o+', 'T9o', '98o'],
  SB: ['22+', 'A2s+', 'K5s+', 'Q7s+', 'J7s+', 'T7s+', '96s+', '85s+', '74s+', '64s+', '53s+', 'A2o+', 'K9o+', 'Q9o+', 'J9o+', 'T9o'],
}
// BB flat-call vs each raiser (src/data/vsRfi.ts)
const BB_CALL = {
  UTG: ['22-JJ', 'ATs+', 'KTs+', 'QTs+', 'JTs', 'T9s', '98s', '87s', '76s', 'AQo', 'KQo'],
  HJ: ['22-99', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T8s+', '97s+', '86s+', '76s', '65s', '54s', 'ATo+', 'KJo+', 'QJo'],
  CO: ['22-99', 'A2s+', 'K7s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '86s+', '75s+', '65s', '54s', 'ATo+', 'KJo+', 'QJo'],
  BTN: ['22-66', 'A2s+', 'K2s+', 'Q5s+', 'J7s+', 'T7s+', '96s+', '85s+', '75s+', '64s+', '53s+', 'A2o+', 'K9o+', 'Q9o+', 'J9o+', 'T9o'],
  SB: ['22-55', 'A2s+', 'K2s+', 'Q6s+', 'J7s+', 'T7s+', '96s+', '86s+', '75s+', '65s', '54s', 'A7o+', 'KTo+', 'QTo+', 'JTo'],
}

const MATCHUP = process.env.MATCHUP || 'btn_bb'
const opener = MATCHUP.split('_')[0].toUpperCase() // CO, HJ, UTG, BTN, SB

// Blind battle: SB opens (OOP), BB calls (IP). Otherwise opener is IP, BB is OOP.
let ipTokens, oopTokens
if (opener === 'SB') {
  ipTokens = BB_CALL.SB // BB is in position vs the SB open
  oopTokens = OPEN.SB // SB is the OOP aggressor
} else {
  ipTokens = OPEN[opener] // opener is in position vs the BB
  oopTokens = BB_CALL[opener] // BB defends out of position
}

console.log('IP_RANGE=' + expand(ipTokens))
console.log('OOP_RANGE=' + expand(oopTokens))
