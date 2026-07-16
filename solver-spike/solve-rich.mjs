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
const SHARDS = join(here, 'shards')
mkdirSync(SHARDS, { recursive: true })

const SMOKE = process.env.SMOKE === '1'
const THREADS = 1 // ~10% — gentle so it doesn't lag the Mac in use (was 2)
const FLOP_ITERS = SMOKE ? 20 : 100 // slight bump over 90: facing-line nodes are thinner
const TURN_ITERS = SMOKE ? 20 : 90
const TURNS_PER_BOARD = SMOKE ? 2 : 6
const RIVERS_PER_TURN = SMOKE ? 4 : 12
const MAX_TURN_NODES = 16 // stage-1 turn nodes kept per line

// Even ~1/3 stride over the 400-board texture sample = ~134 rich boards
const RICH_BOARDS = SMOKE ? [BOARDS[0]] : BOARDS.filter((_, i) => i % 3 === 0)

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

// ---- aggregators -----------------------------------------------------------
// Betting node (hero acts after a check): buckets = check + each sizing bet,
// all-in folded into the largest sizing. `sizeTags` maps ascending bet amounts
// to action names, e.g. ['bet66','bet150'].
const ALLIN_MIN = 25 // bb (flop/turn)
const ALLIN_MIN_RIVER = 60 // bb: river pots run ~21bb, the 175% overbet (~37bb) is a sizing bet
function aggregateBets(node, sizeTags, sizeFracs, allinMin = ALLIN_MIN) {
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
    const lab = label169(combo)
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
function aggregateDefense(node) {
  const { actions, strategy } = node.strategy
  const foldIdx = actions.indexOf('FOLD')
  const callIdx = actions.indexOf('CALL')
  const raiseIdxs = actions.map((a, i) => (a.startsWith('RAISE') || a.startsWith('BET') ? i : -1)).filter((i) => i >= 0)
  const acc = new Map()
  for (const [combo, freqs] of Object.entries(strategy)) {
    const lab = label169(combo)
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

const baseNode = (board, street, extra) => ({
  spot: 'BTN_vs_BB_SRP',
  board,
  street,
  heroAction: 'none',
  potType: 'srp',
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
  const ranges = execFileSync('node', [join(here, 'build-ranges.mjs')]).toString()
  const ip = ranges.match(/^IP_RANGE=(.*)$/m)[1]
  const oop = ranges.match(/^OOP_RANGE=(.*)$/m)[1]
  return `set_pot 5.5
set_effective_stack 97.5
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
  const openHist = ['BTN opens 2.5bb', 'BB calls', `Flop: ${toks.join(' ')}`]

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
  const baseHist = ['BTN opens 2.5bb', 'BB calls', `Flop: ${toks.join(' ')}`, 'BB checks', 'BTN bets 1.8bb', 'BB calls', `Turn: ${tc}`]

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
    index.push({ board: f.replace('.json', ''), nodes: nodes.length, facing, streets })
  }
  index.sort((a, b) => a.board.localeCompare(b.board))
  writeFileSync(join(SHARDS, 'index.json'), JSON.stringify({ generatedAt: today(), totalBytes: bytes, boards: index }))
  return { boards: index.length, mb: (bytes / 1e6).toFixed(1) }
}

const t00 = Date.now()
let doneCount = 0
for (const board of RICH_BOARDS) {
  const shardPath = join(SHARDS, `${board}.json`)
  if (existsSync(shardPath)) {
    console.log(`skip ${board} (shard exists)`)
    continue
  }
  console.log(`=== ${board} (${++doneCount}) ===`)
  const t0 = Date.now()

  const flopTree = solveOne(`rich_${board}.txt`, `rich_${board}_result.json`, buildFlopInput(board, `rich_${board}_result.json`))
  if (!flopTree) continue
  const { nodes, turnRanges } = extractFlop(board, flopTree)
  console.log(`  flop stage: ${nodes.length} nodes`)

  if (turnRanges.ip && turnRanges.oop) {
    for (const tc of turnRanges.cards) {
      const inN = `rich_${board}${tc}.txt`
      const outN = `rich_${board}${tc}_result.json`
      const turnTree = solveOne(inN, outN, buildTurnInput(board, tc, turnRanges, outN))
      if (!turnTree) continue
      const tNodes = extractTurnTree(board, tc, turnTree)
      nodes.push(...tNodes)
      console.log(`  turn ${tc}: +${tNodes.length} nodes`)
    }
  }

  writeFileSync(shardPath, JSON.stringify(nodes))
  const stats = writeIndex()
  const mins = Math.round((Date.now() - t0) / 60000)
  const kb = Math.round(statSync(shardPath).size / 1024)
  console.log(`  -> shard ${kb}KB in ${mins}min · corpus now ${stats.boards} boards, ${stats.mb}MB`)
}

const totalMin = Math.round((Date.now() - t00) / 60000)
console.log(`\nbatch done in ${totalMin}min: ${JSON.stringify(writeIndex())}`)
