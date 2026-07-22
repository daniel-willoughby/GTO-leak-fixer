// Rich BTN-vs-BB SRP corpus: deep turns + rivers AND "real game" facing-line
// nodes (facing a donk bet, a check-raise, an overbet lead) for the native app.
//
// Two stages per flop board, both disk-safe (dump -> extract -> delete):
//   1. Flop-rooted solve (dump_rounds 2, the proven config): flop c-bet node,
//      facing-donk + facing-check-raise nodes, up to 16 turn cards per line,
//      plus the ranges that reach the turn in the cbet-called line.
//   2. For TURNS_PER_BOARD sampled turn cards, a turn-rooted solve seeded with
//      those ranges (dump_rounds 2 = turn + river, small dumps — avoids the
//      GB-sized dump_rounds 3). Richer sizes here: turn lead 33/125, IP barrel
//      66/150, river 75/175 both ways. Extracts turn + river hero nodes and the
//      facing-donk / facing-overbet / facing-check-raise defense nodes.
//
// Output: per-board shard files in solver-spike/shards/<flop>.json + index.json
// (no giant accumulator, no giant merges). Resumable: boards with an existing
// shard are skipped. Run:
//   caffeinate -i node solver-spike/solve-rich.mjs         # full batch
//   SMOKE=1 node solver-spike/solve-rich.mjs               # 1 board, low iters
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { execFileSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { BOARDS } from './solve-boards.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const INSTALL = '/Users/danwilloughby/Documents/Code Projects/TexasSolver/install'
const SHARDS = process.env.SHARDS_DIR ? join(here, process.env.SHARDS_DIR) : join(here, 'shards')
mkdirSync(SHARDS, { recursive: true })

const SMOKE = process.env.SMOKE === '1'
const THREADS = 2 // 2 cores
const FLOP_ITERS = SMOKE ? 20 : 120 // marginal spots are EV-close, so converge a touch harder
const TURN_ITERS = SMOKE ? 20 : 90
const TURNS_PER_BOARD = SMOKE ? 2 : 6
const RIVERS_PER_TURN = SMOKE ? 4 : 12
const MAX_TURN_NODES = 16 // stage-1 turn nodes kept per line

// MATCHUP (env) selects who is in the pot and the pot type. Postflop the blinds
// act first, so vs an opener the BB is OOP (aggressor = the IP opener); in a
// blind battle the SB is OOP (aggressor = the OOP SB). aggr: 'ip' uses the deep
// srp extractor (flop+turn+river); aggr: 'oop' uses the flop-rooted extractor
// (flop+turn), shared with 3bp. Seat labels are relabelled onto the proven
// BTN-vs-BB extractor output, so the tree logic is never touched.
// prePH is the preamble in PLACEHOLDER seats (BTN = the IP player, BB = the OOP
// player). Every extractor emits BTN/BB placeholder seats; a single relabel
// (BTN -> ipSeat, BB -> oopSeat) at the end maps them to the matchup's real
// seats. So an opener-vs-BB pot uses BTN=opener (IP), and a blind battle uses
// BB=SB (OOP aggressor) opening into BTN=BB (IP).
const MATCHUPS = {
  btn_bb: { suffix: '', spot: 'BTN_vs_BB_SRP', potType: 'srp', aggr: 'ip', ipSeat: 'BTN', oopSeat: 'BB', pot: 5.5, stack: 97.5, prePH: ['BTN opens 2.5bb', 'BB calls'], mod: 3 },
  co_bb: { suffix: '-cobb', spot: 'CO_vs_BB_SRP', potType: 'srp', aggr: 'ip', ipSeat: 'CO', oopSeat: 'BB', pot: 5.5, stack: 97.5, prePH: ['BTN opens 2.5bb', 'BB calls'], mod: 16 },
  hj_bb: { suffix: '-hjbb', spot: 'HJ_vs_BB_SRP', potType: 'srp', aggr: 'ip', ipSeat: 'HJ', oopSeat: 'BB', pot: 5.5, stack: 97.5, prePH: ['BTN opens 2.5bb', 'BB calls'], mod: 16 },
  utg_bb: { suffix: '-utgbb', spot: 'UTG_vs_BB_SRP', potType: 'srp', aggr: 'ip', ipSeat: 'UTG', oopSeat: 'BB', pot: 5.5, stack: 97.5, prePH: ['BTN opens 2.5bb', 'BB calls'], mod: 16 },
  sb_bb: { suffix: '-sbbb', spot: 'SB_vs_BB_SRP', potType: 'srp', aggr: 'oop', ipSeat: 'BB', oopSeat: 'SB', pot: 5.5, stack: 97.5, prePH: ['BB opens 2.5bb', 'BTN calls'], mod: 10 },
  btn_bb_3bp: { suffix: '-3bp', spot: 'BTN_vs_BB_3BP', potType: '3bp', aggr: 'oop', ipSeat: 'BTN', oopSeat: 'BB', pot: 22.5, stack: 89, prePH: ['BTN opens 2.5bb', 'BB 3-bets 11bb', 'BTN calls'], mod: 7 },
}
const MATCHUP = process.env.MATCHUP || (process.env.SKELETON === '3bp' ? 'btn_bb_3bp' : 'btn_bb')
const M = MATCHUPS[MATCHUP]
if (!M) {
  console.error(`unknown MATCHUP "${MATCHUP}" — one of: ${Object.keys(MATCHUPS).join(', ')}`)
  process.exit(1)
}

// Marginality filter: drop near-pure nodes so every shipped spot is a real
// decision. A node's marginality = 1 - mean(top-action frequency) across its
// range; 0 = everyone plays one action, higher = more mixing. Keep nodes at or
// above MARGIN, with a per-board floor so no board ships empty.
const MARGIN = process.env.MARGIN ? parseFloat(process.env.MARGIN) : 0.08
const MIN_KEEP = 8 // never shrink a board below this many (its most marginal)

// Even texture stride per matchup (btn_bb keeps its every-3rd ~134-board set;
// the new positions take a lighter slice). Override with BOARD_MOD.
const MOD = process.env.BOARD_MOD ? parseInt(process.env.BOARD_MOD, 10) : M.mod
const RICH_BOARDS = process.env.BOARD ? [process.env.BOARD] : SMOKE ? [BOARDS[0]] : BOARDS.filter((_, i) => i % MOD === 0)

const RANKS = 'AKQJT98765432'
const round3 = (x) => Math.round(x * 1000) / 1000
const today = () => new Date().toISOString().slice(0, 10)
const boardTokens = (b) => b.match(/../g)
const normCard = (raw) => raw.replace(/[^AKQJTakqjt2-9shdc]/g, '').slice(0, 2)

function label169(combo) {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}

// Suit-aware hand label. label169 collapses all four suits into one class, which
// is fine on rainbow boards but WRONG on flushy ones: it averages a made flush /
// flush draw in with the non-flush combos of the same rank class (e.g. 87s on a
// monotone heart board folds the 8h7h flush 75% because 3 of 4 suited combos
// aren't flushes). This sub-buckets by the board's flush suit so those never mix.
// Key = "<169>|<boardSuitCount><holeSuitCount>" for the suit giving the combo its
// strongest flush, e.g. "A5s|32" = board has 3 of a suit and both hole cards are
// that suit (a made flush); "A5s|30" = same board, neither hole card is. Rainbow/
// dry boards (no suit 2+) get no suffix, i.e. == label169. The APP MUST compute
// this identical key from the dealt combo + board (suit order 's','h','d','c').
function suitAwareLabel(combo, boardStr) {
  const base = label169(combo)
  if (!boardStr) return base
  const bc = {}
  for (let i = 1; i < boardStr.length; i += 2) bc[boardStr[i]] = (bc[boardStr[i]] || 0) + 1
  const hs = [combo[1], combo[3]]
  let best = null
  for (const s of ['s', 'h', 'd', 'c']) {
    const b = bc[s] || 0
    if (b < 2) continue // this suit can't make a flush
    const h = hs.filter((x) => x === s).length
    const tot = b + h
    if (!best || tot > best.tot) best = { b, h, tot }
  }
  return best ? `${base}|${best.b}${best.h}` : base
}

// ---- aggregators -----------------------------------------------------------
// Betting node (hero acts after a check): buckets = check + each sizing bet,
// all-in folded into the largest sizing. `sizeTags` maps ascending bet amounts
// to action names, e.g. ['bet66','bet150'].
const ALLIN_MIN = 25 // bb (flop/turn)
const ALLIN_MIN_RIVER = 60 // bb: river pots run ~21bb, the 175% overbet (~37bb) is a sizing bet
// The board of the node currently being aggregated, for suitAwareLabel. Set at
// each street boundary in the extractors (sequential, single-threaded), so the
// aggregators pick up the right board without threading it through 25 call sites.
let curBoard = ''
function aggregateBets(node, sizeTags, sizeFracs, allinMin = ALLIN_MIN, board = curBoard) {
  const { actions, strategy } = node.strategy
  const checkIdx = actions.indexOf('CHECK')
  const bets = actions
    .map((a, i) => ({ i, amt: parseFloat(a.split(' ')[1]) }))
    .filter((x) => actions[x.i].startsWith('BET'))
    .sort((p, q) => p.amt - q.amt)
  const sizing = bets.filter((b) => b.amt < allinMin).slice(0, sizeTags.length)
  const allinIdxs = bets.filter((b) => !sizing.includes(b)).map((b) => b.i)
  const outActions = ['check', ...sizing.map((_, k) => sizeTags[k])]
  const betSizes = sizing.map((_, k) => sizeFracs[k])
  const lastCol = outActions.length - 1
  const acc = new Map()
  for (const [combo, freqs] of Object.entries(strategy)) {
    const lab = suitAwareLabel(combo, board)
    const row = acc.get(lab) ?? { sums: new Array(outActions.length).fill(0), n: 0 }
    row.sums[0] += freqs[checkIdx] ?? 0
    sizing.forEach((b, k) => (row.sums[k + 1] += freqs[b.i] ?? 0))
    allinIdxs.forEach((i) => (row.sums[lastCol] += freqs[i] ?? 0))
    row.n += 1
    acc.set(lab, row)
  }
  const out = {}
  for (const [lab, v] of acc) out[lab] = v.sums.map((s) => round3(s / v.n))
  return { actions: outActions, betSizes, strategy: out }
}

// Defense node (hero faces a bet/raise): fold / call / raise, with all raise
// sizes and the jam folded into one raise bucket.
function aggregateDefense(node, board = curBoard) {
  const { actions, strategy } = node.strategy
  const foldIdx = actions.indexOf('FOLD')
  const callIdx = actions.indexOf('CALL')
  const raiseIdxs = actions.map((a, i) => (a.startsWith('RAISE') || a.startsWith('BET') ? i : -1)).filter((i) => i >= 0)
  const acc = new Map()
  for (const [combo, freqs] of Object.entries(strategy)) {
    const lab = suitAwareLabel(combo, board)
    const row = acc.get(lab) ?? { sums: [0, 0, 0], n: 0 }
    row.sums[0] += freqs[foldIdx] ?? 0
    row.sums[1] += freqs[callIdx] ?? 0
    raiseIdxs.forEach((i) => (row.sums[2] += freqs[i] ?? 0))
    row.n += 1
    acc.set(lab, row)
  }
  const out = {}
  for (const [lab, v] of acc) out[lab] = v.sums.map((s) => round3(s / v.n))
  return { actions: ['fold', 'call', 'raise'], strategy: out }
}

// Marginality of an aggregated strategy ({ label: [freqs] }): 1 - mean top-action
// frequency across the range. 0 = fully pure (no decision), higher = more mixed.
function marginality(strategy) {
  const labels = Object.keys(strategy || {})
  if (!labels.length) return 0
  let sumMax = 0
  for (const l of labels) sumMax += Math.max(...strategy[l])
  return round3(1 - sumMax / labels.length)
}

// Map the extractors' placeholder seats (BTN = IP, BB = OOP) to the matchup's
// real seats in hero/villain/history. Single-pass with a callback so BTN -> BB
// and BB -> SB (the blind battle) don't collide. spot/potType are already final.
function relabelSeats(nodes) {
  if (M.ipSeat === 'BTN' && M.oopSeat === 'BB') return nodes // btn_bb, btn_bb_3bp: no-op
  const swap = (s) => s.replace(/\bBTN\b|\bBB\b/g, (t) => (t === 'BTN' ? M.ipSeat : M.oopSeat))
  for (const n of nodes) {
    if (n.hero) n.hero = swap(n.hero)
    if (n.villain) n.villain = swap(n.villain)
    if (Array.isArray(n.history)) n.history = n.history.map(swap)
  }
  return nodes
}

// Index of the smallest BET action in a raw solver strategy (actions aren't
// guaranteed size-ordered).
const smallBetIdx = (strat) => {
  const bets = strat.actions
    .map((a, i) => ({ i, amt: parseFloat(a.split(' ')[1]) }))
    .filter((x) => strat.actions[x.i].startsWith('BET'))
    .sort((p, q) => p.amt - q.amt)
  return bets.length ? bets[0].i : -1
}

// Extractors emit placeholder BTN/BB seats + the matchup's final spot/potType;
// relabelSeats() maps BTN/BB to the real seats after extraction.
const baseNode = (board, street, extra) => ({
  spot: M.spot,
  board,
  street,
  heroAction: 'none',
  potType: M.potType,
  hero: 'BTN',
  villain: 'BB',
  facing: 'check',
  meta: { solver: 'TexasSolver', generatedAt: today(), approximate: false },
  ...extra,
})

// find children keys by prefix, ascending amount
const kidKeys = (node, prefix) =>
  Object.keys(node?.childrens ?? {})
    .filter((k) => k.startsWith(prefix))
    .sort((a, b) => parseFloat(a.split(' ')[1]) - parseFloat(b.split(' ')[1]))

function rangeString(weights) {
  const acc = new Map()
  for (const [combo, w] of Object.entries(weights)) {
    const k = label169(combo)
    const cur = acc.get(k) ?? { sum: 0, n: 0 }
    cur.sum += w
    cur.n += 1
    acc.set(k, cur)
  }
  const parts = []
  for (const [k, v] of acc) {
    const w = v.sum / v.n
    if (w >= 0.02) parts.push(`${k}:${round3(w)}`)
  }
  return parts.join(',')
}

// even sample of n keys across an array
const sampleEven = (arr, n) => {
  if (arr.length <= n) return arr
  const step = arr.length / n
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)])
}

// ---- stage 1: flop-rooted --------------------------------------------------
function buildFlopInput(board, outName) {
  const cb = boardTokens(board).join(',')
  const ranges = execFileSync('node', [join(here, 'build-ranges-matchup.mjs')], { env: { ...process.env, MATCHUP } }).toString()
  const ip = ranges.match(/^IP_RANGE=(.*)$/m)[1]
  const oop = ranges.match(/^OOP_RANGE=(.*)$/m)[1]

  // aggr 'oop': the OOP player is the aggressor (3bp, or SB blind battle), so it
  // gets the two c-bet sizes and IP gets a single delayed-stab size. Low SPR, no
  // giant tree. aggr 'ip' keeps the proven deep srp config (IP is the aggressor).
  if (M.aggr === 'oop') {
    return `set_pot ${M.pot}
set_effective_stack ${M.stack}
set_board ${cb}
set_range_ip ${ip}
set_range_oop ${oop}
set_bet_sizes oop,flop,bet,33,75
set_bet_sizes oop,flop,raise,60
set_bet_sizes oop,flop,allin
set_bet_sizes ip,flop,bet,33
set_bet_sizes ip,flop,raise,60
set_bet_sizes ip,flop,allin
set_bet_sizes oop,turn,bet,50,100
set_bet_sizes oop,turn,raise,60
set_bet_sizes oop,turn,allin
set_bet_sizes ip,turn,bet,66
set_bet_sizes ip,turn,raise,60
set_bet_sizes ip,turn,allin
set_allin_threshold 0.67
build_tree
set_thread_num ${THREADS}
set_accuracy 0.4
set_max_iteration ${FLOP_ITERS}
set_print_interval 30
set_use_isomorphism 1
start_solve
set_dump_rounds 2
dump_result ${outName}
`
  }

  return `set_pot ${M.pot}
set_effective_stack ${M.stack}
set_board ${cb}
set_range_ip ${ip}
set_range_oop ${oop}
set_bet_sizes oop,flop,bet,33
set_bet_sizes oop,flop,raise,75
set_bet_sizes oop,flop,allin
set_bet_sizes ip,flop,bet,33,75
set_bet_sizes ip,flop,raise,75
set_bet_sizes ip,flop,allin
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
set_thread_num ${THREADS}
set_accuracy 0.5
set_max_iteration ${FLOP_ITERS}
set_print_interval 30
set_use_isomorphism 1
start_solve
set_dump_rounds 2
dump_result ${outName}
`
}

// OOP (BB) hero node helper: flips the seat metadata
const bbNode = (board, street, extra) => ({
  ...baseNode(board, street, extra),
  hero: 'BB',
  villain: 'BTN',
  ...extra,
})

function extractFlop(board, tree) {
  const nodes = []
  const toks = boardTokens(board)
  const openHist = [...M.prePH, `Flop: ${toks.join(' ')}`]
  curBoard = board // flop nodes below aggregate against the 3-card board

  // hero (BB) FIRST ACTION on the flop: check or donk-lead into the raiser
  if (tree?.strategy) {
    const agg = aggregateBets(tree, ['bet33'], [0.33])
    nodes.push(bbNode(board, 'flop', { facing: 'first', history: openHist, betSizes: agg.betSizes, actions: agg.actions, strategy: agg.strategy }))
  }

  // hero (BTN) c-bet node after BB checks
  const ipCbet = tree.childrens?.CHECK
  if (ipCbet?.strategy) {
    const agg = aggregateBets(ipCbet, ['bet33', 'bet75'], [0.33, 0.75])
    nodes.push(baseNode(board, 'flop', { history: openHist.slice(0, 2), betSizes: agg.betSizes, actions: agg.actions, strategy: agg.strategy }))
  }

  // hero (BB) FACING THE C-BET: fold/call/check-raise vs each size
  const cbetKeys = kidKeys(ipCbet, 'BET').filter((k) => parseFloat(k.split(' ')[1]) < ALLIN_MIN)
  cbetKeys.slice(0, 2).forEach((bk, idx) => {
    const n = ipCbet.childrens[bk]
    if (!n?.strategy) return
    const tag = idx === 0 ? 'cbet33' : 'cbet75'
    nodes.push(
      bbNode(board, 'flop', {
        facing: tag,
        history: [...openHist, 'BB checks', idx === 0 ? 'BTN c-bets 1.8bb' : 'BTN c-bets 4.1bb'],
        ...aggregateDefense(n),
      }),
    )
  })

  // FACING DONK: BB leads into the raiser -> BTN's fold/call/raise
  for (const dk of kidKeys(tree, 'BET').slice(0, 1)) {
    const n = tree.childrens[dk]
    if (!n?.strategy) continue
    nodes.push(
      baseNode(board, 'flop', {
        facing: 'donk33',
        history: [...openHist, 'BB donk-bets 1.8bb'],
        ...aggregateDefense(n),
      }),
    )
  }

  // FACING CHECK-RAISE: BB checks, BTN bets small, BB raises -> BTN's response
  const smallBetKey = kidKeys(ipCbet, 'BET')[0]
  const afterCbet = smallBetKey ? ipCbet.childrens[smallBetKey] : null
  for (const rk of kidKeys(afterCbet, 'RAISE').slice(0, 1)) {
    const n = afterCbet.childrens[rk]
    if (!n?.strategy) continue
    nodes.push(
      baseNode(board, 'flop', {
        facing: 'checkraise',
        history: [...openHist, 'BB checks', 'BTN bets 1.8bb', 'BB check-raises 6.3bb'],
        ...aggregateDefense(n),
      }),
    )
  }

  // TURN nodes: cbet-called line + check-check line (as before, deeper cap)
  const turnSrc = afterCbet?.childrens?.CALL
  const turnRangesOut = { ip: null, oop: null, cards: [] }
  if (turnSrc?.dealcards) {
    const cards = Object.keys(turnSrc.dealcards)
    for (const rawCard of cards.slice(0, MAX_TURN_NODES)) {
      const tc = normCard(rawCard)
      curBoard = board + tc
      const cbetHist = [...openHist, 'BB checks', 'BTN bets 1.8bb', 'BB calls', `Turn: ${tc}`]
      const oopTurn = turnSrc.dealcards[rawCard]
      // hero (BB) turn decision after check-calling the flop: check or lead
      if (oopTurn?.strategy) {
        const oa = aggregateBets(oopTurn, ['bet33'], [0.33])
        nodes.push(bbNode(board + tc, 'turn', { facing: 'first', history: cbetHist, betSizes: oa.betSizes, actions: oa.actions, strategy: oa.strategy }))
      }
      const turnIp = oopTurn?.childrens?.CHECK
      if (!turnIp?.strategy) continue
      const ta = aggregateBets(turnIp, ['bet33', 'bet75'], [0.33, 0.75])
      nodes.push(
        baseNode(board + tc, 'turn', {
          history: [...openHist, 'BB checks', 'BTN bets 1.8bb', 'BB calls'],
          betSizes: ta.betSizes,
          actions: ta.actions,
          strategy: ta.strategy,
        }),
      )
      // hero (BB) FACING THE TURN BARREL (the bigger size = the tough spot)
      const barrelKeys = kidKeys(turnIp, 'BET').filter((k) => parseFloat(k.split(' ')[1]) < ALLIN_MIN)
      const bigBarrel = barrelKeys[barrelKeys.length - 1]
      if (bigBarrel && turnIp.childrens[bigBarrel]?.strategy) {
        nodes.push(
          bbNode(board + tc, 'turn', {
            facing: 'barrel75',
            history: [...cbetHist, 'BB checks', 'BTN barrels 6.8bb'],
            ...aggregateDefense(turnIp.childrens[bigBarrel]),
          }),
        )
      }
    }
    // ranges for the turn-rooted stage (cbet-called line) + sampled turn cards
    const betIdx = ipCbet.strategy.actions.findIndex((a) => a.startsWith('BET'))
    const ip = {}
    for (const [c, f] of Object.entries(ipCbet.strategy.strategy)) ip[c] = f[betIdx]
    const callIdx = afterCbet.strategy.actions.indexOf('CALL')
    const oop = {}
    for (const [c, f] of Object.entries(afterCbet.strategy.strategy)) oop[c] = f[callIdx]
    turnRangesOut.ip = rangeString(ip)
    turnRangesOut.oop = rangeString(oop)
    turnRangesOut.cards = sampleEven(cards.map(normCard), TURNS_PER_BOARD)
  }
  if (ipCbet?.childrens?.CHECK?.dealcards) {
    const cc = ipCbet.childrens.CHECK
    for (const rawCard of Object.keys(cc.dealcards).slice(0, MAX_TURN_NODES)) {
      const tc = normCard(rawCard)
      curBoard = board + tc
      const ccHist = [...openHist, 'BB checks', 'BTN checks back', `Turn: ${tc}`]
      // hero (BB) PROBE decision: flop checked through, BB acts first on the turn
      const oopProbe = cc.dealcards[rawCard]
      if (oopProbe?.strategy) {
        const pa = aggregateBets(oopProbe, ['bet33'], [0.33])
        nodes.push(bbNode(board + tc, 'turn', { facing: 'first', history: ccHist, betSizes: pa.betSizes, actions: pa.actions, strategy: pa.strategy }))
      }
      const oopTurn = oopProbe?.childrens?.CHECK
      if (!oopTurn?.strategy) continue
      const ta = aggregateBets(oopTurn, ['bet33', 'bet75'], [0.33, 0.75])
      nodes.push(
        baseNode(board + tc, 'turn', {
          history: [...openHist, 'BB checks', 'BTN checks back'],
          betSizes: ta.betSizes,
          actions: ta.actions,
          strategy: ta.strategy,
        }),
      )
    }
  }
  return { nodes, turnRanges: turnRangesOut }
}

// ---- 3-bet-pot extractor (flop-rooted, flop + turn) ------------------------
// BB (OOP) is the aggressor: it c-bets, BTN (IP) defends. Mirror of the srp
// flop tree with the bettor swapped. Turn is taken from the c-bet-called line
// in the same dump (no separate river solve — SPR is low, ~4 → ~2).
const ALLIN_MIN_3BP_TURN = 70 // bb: 3bp turn pot ~37, a 100%-pot barrel (~37bb) is a real size, not a jam
const bbAmt = (key) => Math.round(parseFloat(key.split(' ')[1]))

function extractFlop3bp(board, tree) {
  const nodes = []
  const toks = boardTokens(board)
  const pre = M.prePH
  const openHist = [...pre, `Flop: ${toks.join(' ')}`]
  curBoard = board // flop nodes below aggregate against the 3-card board

  // BB (OOP aggressor) flop c-bet decision: check or c-bet 33/75
  if (tree?.strategy) {
    const agg = aggregateBets(tree, ['bet33', 'bet75'], [0.33, 0.75])
    nodes.push(bbNode(board, 'flop', { facing: 'first', history: openHist, betSizes: agg.betSizes, actions: agg.actions, strategy: agg.strategy }))
  }

  // BTN (IP) FACING the c-bet: fold/call/raise vs each size
  const cbetKeys = kidKeys(tree, 'BET').filter((k) => bbAmt(k) < ALLIN_MIN_3BP_TURN)
  cbetKeys.slice(0, 2).forEach((bk, idx) => {
    const n = tree.childrens[bk]
    if (!n?.strategy) return
    nodes.push(
      baseNode(board, 'flop', {
        facing: idx === 0 ? 'cbet33' : 'cbet75',
        history: [...openHist, `BB c-bets ${bbAmt(bk)}bb`],
        ...aggregateDefense(n),
      }),
    )
  })

  // BTN (IP) stab after BB checks (delayed c-bet by the caller)
  const ipStab = tree.childrens?.CHECK
  if (ipStab?.strategy) {
    const agg = aggregateBets(ipStab, ['bet33'], [0.33])
    nodes.push(baseNode(board, 'flop', { history: [...openHist, 'BB checks'], betSizes: agg.betSizes, actions: agg.actions, strategy: agg.strategy }))
  }

  // BB (OOP) FACING the stab
  const stabKey = kidKeys(ipStab, 'BET')[0]
  const afterStab = stabKey ? ipStab.childrens[stabKey] : null
  if (afterStab?.strategy) {
    nodes.push(
      bbNode(board, 'flop', {
        facing: 'stab33',
        history: [...openHist, 'BB checks', `BTN bets ${bbAmt(stabKey)}bb`],
        ...aggregateDefense(afterStab),
      }),
    )
  }

  // TURN nodes off the c-bet-called line (BB c-bets small, BTN calls)
  const smallKey = cbetKeys[0]
  const afterCbet = smallKey ? tree.childrens[smallKey] : null
  const turnSrc = afterCbet?.childrens?.CALL
  if (turnSrc?.dealcards) {
    for (const rawCard of Object.keys(turnSrc.dealcards).slice(0, MAX_TURN_NODES)) {
      const tc = normCard(rawCard)
      curBoard = board + tc
      const cbetHist = [...openHist, `BB c-bets ${bbAmt(smallKey)}bb`, 'BTN calls', `Turn: ${tc}`]
      const oopTurn = turnSrc.dealcards[rawCard]
      // BB (OOP) turn barrel decision: check or barrel 50/100
      if (oopTurn?.strategy) {
        const ta = aggregateBets(oopTurn, ['bet50', 'bet100'], [0.5, 1.0], ALLIN_MIN_3BP_TURN)
        nodes.push(bbNode(board + tc, 'turn', { facing: 'first', history: cbetHist, betSizes: ta.betSizes, actions: ta.actions, strategy: ta.strategy }))
      }
      // BTN (IP) FACING the turn barrel (the larger size = the tough spot)
      const barrelKeys = kidKeys(oopTurn, 'BET').filter((k) => bbAmt(k) < ALLIN_MIN_3BP_TURN)
      const bigBarrel = barrelKeys[barrelKeys.length - 1]
      if (bigBarrel && oopTurn.childrens[bigBarrel]?.strategy) {
        nodes.push(
          baseNode(board + tc, 'turn', {
            facing: 'barrel',
            history: [...cbetHist, `BB barrels ${bbAmt(bigBarrel)}bb`],
            ...aggregateDefense(oopTurn.childrens[bigBarrel]),
          }),
        )
      }
    }
  }
  return nodes
}

// ---- stage 2: turn-rooted (turn + all rivers in-dump) -----------------------
function buildTurnInput(flop, tc, ranges, outName) {
  return `set_pot 9.1
set_effective_stack 95.7
set_board ${boardTokens(flop).join(',')},${tc}
set_range_ip ${ranges.ip}
set_range_oop ${ranges.oop}
set_bet_sizes oop,turn,bet,33,125
set_bet_sizes oop,turn,raise,75
set_bet_sizes oop,turn,allin
set_bet_sizes ip,turn,bet,66,150
set_bet_sizes ip,turn,raise,75
set_bet_sizes ip,turn,allin
set_bet_sizes oop,river,bet,75,175
set_bet_sizes oop,river,raise,100
set_bet_sizes oop,river,allin
set_bet_sizes ip,river,bet,75,175
set_bet_sizes ip,river,raise,100
set_bet_sizes ip,river,allin
set_allin_threshold 0.67
build_tree
set_thread_num ${THREADS}
set_accuracy 0.5
set_max_iteration ${TURN_ITERS}
set_print_interval 30
set_use_isomorphism 1
start_solve
set_dump_rounds 2
dump_result ${outName}
`
}

function extractTurnTree(flop, tc, tree) {
  const nodes = []
  const board8 = flop + tc
  const toks = boardTokens(flop)
  curBoard = board8 // turn nodes below aggregate against the 4-card board
  const baseHist = [...M.prePH, `Flop: ${toks.join(' ')}`, 'BB checks', 'BTN bets 1.8bb', 'BB calls', `Turn: ${tc}`]

  // hero (BB) turn first action: check, lead 33, or overbet-lead 125
  if (tree?.strategy) {
    const oa = aggregateBets(tree, ['bet33', 'bet125'], [0.33, 1.25])
    nodes.push(bbNode(board8, 'turn', { facing: 'first', history: baseHist, betSizes: oa.betSizes, actions: oa.actions, strategy: oa.strategy }))
  }

  // hero turn barrel node (facing check), sizes 66/150
  const ipTurn = tree.childrens?.CHECK
  if (ipTurn?.strategy) {
    const ta = aggregateBets(ipTurn, ['bet66', 'bet150'], [0.66, 1.5])
    nodes.push(baseNode(board8, 'turn', { history: baseHist, betSizes: ta.betSizes, actions: ta.actions, strategy: ta.strategy }))
  }

  // hero (BB) FACING THE BARREL: vs 66% and vs the 150% overbet
  const ipBarrelKeys = kidKeys(ipTurn, 'BET').filter((k) => parseFloat(k.split(' ')[1]) < ALLIN_MIN)
  ipBarrelKeys.slice(0, 2).forEach((bk, idx) => {
    const n = ipTurn?.childrens?.[bk]
    if (!n?.strategy) return
    const big = idx === ipBarrelKeys.slice(0, 2).length - 1 && ipBarrelKeys.length > 1
    nodes.push(
      bbNode(board8, 'turn', {
        facing: big ? 'overbet150' : 'barrel66',
        history: [...baseHist, 'BB checks', big ? 'BTN overbets 13.7bb' : 'BTN bets 6bb'],
        ...aggregateDefense(n),
      }),
    )
  })

  // FACING TURN LEADS: small donk 33 and overbet lead 125
  const leadKeys = kidKeys(tree, 'BET')
  leadKeys.slice(0, 2).forEach((lk, idx) => {
    const n = tree.childrens[lk]
    if (!n?.strategy) return
    const big = idx === leadKeys.slice(0, 2).length - 1 && leadKeys.length > 1
    nodes.push(
      baseNode(board8, 'turn', {
        facing: big ? 'overbet-lead' : 'donk33',
        history: [...baseHist, big ? 'BB overbets 11.4bb' : 'BB leads 3bb'],
        ...aggregateDefense(n),
      }),
    )
  })

  // FACING TURN CHECK-RAISE: check, IP bets 66, BB raises
  const tBetKey = kidKeys(ipTurn, 'BET')[0]
  const afterBarrel = tBetKey ? ipTurn.childrens[tBetKey] : null
  for (const rk of kidKeys(afterBarrel, 'RAISE').slice(0, 1)) {
    const n = afterBarrel.childrens[rk]
    if (!n?.strategy) continue
    nodes.push(
      baseNode(board8, 'turn', {
        facing: 'checkraise',
        history: [...baseHist, 'BB checks', 'BTN bets 6bb', 'BB check-raises'],
        ...aggregateDefense(n),
      }),
    )
  }

  // RIVERS off the barrel-called line
  const riverSrc = afterBarrel?.childrens?.CALL
  if (riverSrc?.dealcards) {
    const rivers = sampleEven(Object.keys(riverSrc.dealcards), RIVERS_PER_TURN)
    for (const rawR of rivers) {
      const rc = normCard(rawR)
      const board10 = board8 + rc
      curBoard = board10 // river nodes below aggregate against the 5-card board
      const rNode = riverSrc.dealcards[rawR]
      const rHist = [...baseHist, 'BB checks', 'BTN bets 6bb', 'BB calls', `River: ${rc}`]

      // hero (BB) river first action: check, block-lead 75, or overbet-lead 175
      if (rNode?.strategy) {
        const oa = aggregateBets(rNode, ['bet75', 'bet175'], [0.75, 1.75], ALLIN_MIN_RIVER)
        nodes.push(bbNode(board10, 'river', { facing: 'first', history: rHist, betSizes: oa.betSizes, actions: oa.actions, strategy: oa.strategy }))
      }

      // hero river value/overbet node (facing check), sizes 75/175
      const ipRiver = rNode?.childrens?.CHECK
      if (ipRiver?.strategy) {
        const ra = aggregateBets(ipRiver, ['bet75', 'bet175'], [0.75, 1.75], ALLIN_MIN_RIVER)
        nodes.push(baseNode(board10, 'river', { history: rHist, betSizes: ra.betSizes, actions: ra.actions, strategy: ra.strategy }))
      }

      // hero (BB) FACING THE RIVER BET: vs 75% value bet and vs the 175% overbet
      const ipRBetKeys = kidKeys(ipRiver, 'BET').filter((k) => parseFloat(k.split(' ')[1]) < ALLIN_MIN_RIVER)
      ipRBetKeys.slice(0, 2).forEach((bk, idx) => {
        const n = ipRiver?.childrens?.[bk]
        if (!n?.strategy) return
        const big = idx === ipRBetKeys.slice(0, 2).length - 1 && ipRBetKeys.length > 1
        nodes.push(
          bbNode(board10, 'river', {
            facing: big ? 'overbet175' : 'riverbet75',
            history: [...rHist, 'BB checks', big ? 'BTN overbets 36bb' : 'BTN bets 15bb'],
            ...aggregateDefense(n),
          }),
        )
      })

      // FACING RIVER LEADS: donk 75 and the massive 175% overbet
      const rLeads = kidKeys(rNode, 'BET')
      rLeads.slice(0, 2).forEach((lk, idx) => {
        const n = rNode.childrens[lk]
        if (!n?.strategy) return
        const big = idx === rLeads.slice(0, 2).length - 1 && rLeads.length > 1
        nodes.push(
          baseNode(board10, 'river', {
            facing: big ? 'overbet-lead' : 'donk75',
            history: [...rHist.slice(0, -1), `River: ${rc}`, big ? 'BB overbets 36bb' : 'BB leads 15bb'],
            ...aggregateDefense(n),
          }),
        )
      })

      // FACING RIVER CHECK-RAISE (vs the 75% value bet)
      const rBetKey = kidKeys(ipRiver, 'BET')[0]
      const afterVBet = rBetKey ? ipRiver?.childrens?.[rBetKey] : null
      for (const rk of kidKeys(afterVBet, 'RAISE').slice(0, 1)) {
        const n = afterVBet.childrens[rk]
        if (!n?.strategy) continue
        nodes.push(
          baseNode(board10, 'river', {
            facing: 'checkraise',
            history: [...rHist, 'BB checks', 'BTN bets 15bb', 'BB check-raises'],
            ...aggregateDefense(n),
          }),
        )
      }
    }
  }
  return nodes
}

// ---- run -------------------------------------------------------------------
// TexasSolver occasionally aborts on a valid config ("Card length incorrect: 0"
// / SIGABRT), a transient C++ crash — so retry a failed solve before giving up
// on the board (a lost flop solve loses the whole board).
function solveOne(inName, outName, cfg, attempts = 2) {
  const inPath = join(INSTALL, inName)
  const outPath = join(INSTALL, outName)
  const logName = inName.replace(/\.txt$/, '.log')
  for (let attempt = 1; attempt <= attempts; attempt++) {
    writeFileSync(inPath, cfg)
    try {
      execSync(`./console_solver -i ${inName} > ${logName} 2>&1`, { cwd: INSTALL, stdio: 'ignore' })
    } catch (e) {
      console.error(`  solve attempt ${attempt}/${attempts} FAILED (${inName}, exit ${e.status})`)
      rmSync(inPath, { force: true })
      if (attempt < attempts) continue
      try {
        console.error(execSync(`tail -3 "${join(INSTALL, logName)}"`).toString())
      } catch {}
      return null
    }
    rmSync(inPath, { force: true })
    if (!existsSync(outPath)) {
      if (attempt < attempts) continue
      return null
    }
    const tree = JSON.parse(readFileSync(outPath, 'utf8'))
    rmSync(outPath, { force: true })
    rmSync(join(INSTALL, logName), { force: true })
    return tree
  }
  return null
}

function writeIndex() {
  const files = readdirSync(SHARDS).filter((f) => f.endsWith('.json') && f !== 'index.json')
  const index = []
  let bytes = 0
  for (const f of files) {
    const p = join(SHARDS, f)
    bytes += statSync(p).size
    const nodes = JSON.parse(readFileSync(p, 'utf8'))
    const streets = nodes.reduce((m, n) => ((m[n.street] = (m[n.street] || 0) + 1), m), {})
    const facing = nodes.filter((n) => n.facing !== 'check').length
    const potType = nodes[0]?.potType ?? 'srp'
    index.push({ board: f.replace('.json', ''), potType, nodes: nodes.length, facing, streets })
  }
  index.sort((a, b) => a.board.localeCompare(b.board))
  writeFileSync(join(SHARDS, 'index.json'), JSON.stringify({ generatedAt: today(), totalBytes: bytes, boards: index }))
  return { boards: index.length, mb: (bytes / 1e6).toFixed(1) }
}

const t00 = Date.now()
let doneCount = 0
for (const board of RICH_BOARDS) {
  const suffix = M.suffix
  const shardPath = join(SHARDS, `${board}${suffix}.json`)
  if (existsSync(shardPath)) {
    console.log(`skip ${board}${suffix} (shard exists)`)
    continue
  }
  console.log(`=== ${board}${suffix} (${++doneCount}) ===`)
  const t0 = Date.now()

  const flopTree = solveOne(`rich_${board}.txt`, `rich_${board}_result.json`, buildFlopInput(board, `rich_${board}_result.json`))
  if (!flopTree) continue

  let nodes
  if (M.aggr === 'oop') {
    nodes = extractFlop3bp(board, flopTree)
    console.log(`  flop+turn stage: ${nodes.length} nodes`)
  } else {
    const res = extractFlop(board, flopTree)
    nodes = res.nodes
    console.log(`  flop stage: ${nodes.length} nodes`)
    if (res.turnRanges.ip && res.turnRanges.oop) {
      for (const tc of res.turnRanges.cards) {
        const inN = `rich_${board}${tc}.txt`
        const outN = `rich_${board}${tc}_result.json`
        const turnTree = solveOne(inN, outN, buildTurnInput(board, tc, res.turnRanges, outN))
        if (!turnTree) continue
        const tNodes = extractTurnTree(board, tc, turnTree)
        nodes.push(...tNodes)
        console.log(`  turn ${tc}: +${tNodes.length} nodes`)
      }
    }
  }

  // Relabel placeholder BTN/BB seats to this matchup's real seats.
  relabelSeats(nodes)

  // Marginality: tag every node, then drop near-pure ones so each shipped spot
  // is a real decision (with a floor so no board ends up empty).
  for (const n of nodes) n.marginal = marginality(n.strategy)
  const before = nodes.length
  let kept = nodes.filter((n) => n.marginal >= MARGIN)
  if (kept.length < MIN_KEEP) kept = [...nodes].sort((a, b) => b.marginal - a.marginal).slice(0, Math.min(before, MIN_KEEP))
  nodes = kept
  console.log(`  marginality: kept ${nodes.length}/${before} (>= ${MARGIN})`)

  writeFileSync(shardPath, JSON.stringify(nodes))
  const stats = writeIndex()
  const mins = Math.round((Date.now() - t0) / 60000)
  const kb = Math.round(statSync(shardPath).size / 1024)
  console.log(`  -> shard ${kb}KB in ${mins}min · corpus now ${stats.boards} boards, ${stats.mb}MB`)
}

const totalMin = Math.round((Date.now() - t00) / 60000)
console.log(`\nbatch done in ${totalMin}min: ${JSON.stringify(writeIndex())}`)
