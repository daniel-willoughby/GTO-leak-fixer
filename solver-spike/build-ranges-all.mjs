// Expand the app's preflop ranges into TexasSolver range strings for EVERY
// single-raised-pot matchup we want to solve: each opener vs a BB flat-call.
// In these the opener is the preflop aggressor (IP for UTG/HJ/CO/BTN); BB is the
// OOP defender. Solving them gives Freeplay every opener seat AND the BB-defends
// role with real solver data.
//
//   node solver-spike/build-ranges-all.mjs            # print all matchups
//   node solver-spike/build-ranges-all.mjs CO_vs_BB   # one matchup's IP/OOP
//
// Token lists mirror src/data/ranges.ts (opens) and src/data/vsRfi.ts (BB calls).

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const ri = (r) => RANKS.indexOf(r)

function expandToken(token) {
  if (token.includes('-')) {
    const [a, b] = token.split('-')
    const [from, to] = ri(a[0]) >= ri(b[0]) ? [ri(b[0]), ri(a[0])] : [ri(a[0]), ri(b[0])]
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
  const [hi, lo, suit] = t
  if (!plus) return [`${hi}${lo}${suit}`]
  const out = []
  for (let loIdx = ri(lo); loIdx > ri(hi); loIdx--) out.push(`${hi}${RANKS[loIdx]}${suit}`)
  return out
}
const expand = (tokens) => [...new Set(tokens.flatMap(expandToken))].join(',')

// opener RFI ranges (src/data/ranges.ts → RFI_DEFS)
const OPEN = {
  UTG: ['22+', 'A2s+', 'KTs+', 'QTs+', 'J9s+', 'T9s', '98s', '87s', '76s', '65s', 'ATo+', 'KJo+', 'QJo'],
  HJ: ['22+', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T8s+', '97s+', '86s+', '75s+', '65s', '54s', 'A9o+', 'KTo+', 'QTo+', 'JTo'],
  CO: ['22+', 'A2s+', 'K7s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '86s+', '75s+', '64s+', '54s', 'A7o+', 'KTo+', 'QTo+', 'JTo', 'T9o'],
  BTN: ['22+', 'A2s+', 'K2s+', 'Q4s+', 'J6s+', 'T6s+', '96s+', '85s+', '74s+', '63s+', '53s+', '43s', 'A2o+', 'K8o+', 'Q9o+', 'J9o+', 'T9o', '98o'],
}
// BB flat-call ranges vs each open (src/data/vsRfi.ts → hero:'BB' call sets)
const BB_CALL = {
  UTG: ['22-JJ', 'ATs+', 'KTs+', 'QTs+', 'JTs', 'T9s', '98s', '87s', '76s', 'AQo', 'KQo'],
  HJ: ['22-99', 'A2s+', 'K9s+', 'Q9s+', 'J9s+', 'T8s+', '97s+', '86s+', '76s', '65s', '54s', 'ATo+', 'KJo+', 'QJo'],
  CO: ['22-99', 'A2s+', 'K7s+', 'Q8s+', 'J8s+', 'T8s+', '97s+', '86s+', '75s+', '65s', '54s', 'ATo+', 'KJo+', 'QJo'],
  BTN: ['22-66', 'A2s+', 'K2s+', 'Q5s+', 'J7s+', 'T7s+', '96s+', '85s+', '75s+', '64s+', '53s+', 'A2o+', 'K9o+', 'Q9o+', 'J9o+', 'T9o'],
}

// each matchup: IP = opener, OOP = BB; the opener seat doubles as the postflop position
export const MATCHUPS = ['UTG', 'HJ', 'CO', 'BTN'].map((opener) => ({
  id: `${opener}_vs_BB`,
  opener,
  ip: expand(OPEN[opener]), // preflop raiser, in position
  oop: expand(BB_CALL[opener]), // big blind defender, out of position
}))

const only = process.argv[2]
for (const m of MATCHUPS) {
  if (only && m.id !== only) continue
  console.log(`# ${m.id}`)
  console.log('IP_RANGE=' + m.ip)
  console.log('OOP_RANGE=' + m.oop)
}
