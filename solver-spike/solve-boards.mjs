// Solve a batch of BTN-vs-BB single-raised-pot flops with TWO IP flop bet sizes
// (33% + 75%), and extract the flop + turn nodes into a resumable accumulator.
//
// Disk-safe: solves ONE board at a time, extracts its nodes, then DELETES the
// ~150MB dump before the next board. River data is added separately by
// transform-rivers.mjs (the turn-rooted dumps are untouched).
//
//   node --max-old-space-size=4096 solver-spike/solve-boards.mjs [validate|full]
//
// "validate" solves only VALIDATION_BOARDS; "full" (default) solves all BOARDS.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { execFileSync, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PROJ = join(here, '..')
const INSTALL = '/Users/danwilloughby/Documents/Code Projects/TexasSolver/install'
const ACC = join(here, '.accum-flopturn.json')
// Staging only — never clobber the live corpus. A separate finalize step copies
// this to src/data/street-nodes.json and runs transform-rivers.mjs to re-add river.
const OUT = join(here, '.street-nodes.staging.json')

// Texture-balanced flop set (~30). Originals first so their river data lines up.
const BOARDS = [
  // ace/king/queen-high dry
  'As8c3h', 'Ah7d2c', 'Ad9c4h', 'KsTh5d', 'Kc8d3s', 'Ks9h4c', 'Qs7h2c', 'Qd9c5h', 'Jc8d3h', 'Td7c2s',
  // broadway / connected high
  'KsQh7c', 'AsKd9h', 'QsJh8c', 'JsTd6c',
  // two-tone / connected mid + low
  '9h8h4c', 'Jd7d2s', 'Ts9s5d', '8d7d3c', '7h6d5c', '6s5h4d', '5s4d3h', '9c7d4s', 'Td8c5h',
  // paired
  'AsAd7c', 'KsKh4c', '8s8d3h', '2s2d9h',
  // monotone
  'AhKh4h', 'Qs8s4s', 'Th9h6h',
]
const VALIDATION_BOARDS = ['As8c3h', '9h8h4c', 'AsAd7c', '5s4d3h', 'AhKh4h', 'KsQh7c']

const RANKS = 'AKQJT98765432'
const round = (x) => Math.round(x * 1000) / 1000
const today = () => new Date().toISOString().slice(0, 10)
const boardTokens = (b) => b.match(/../g)
const normaliseCard = (raw) => raw.replace(/[^AKQJTakqjt2-9shdc]/g, '').slice(0, 2)

function label169(combo) {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}

// Per-size aggregation. Surfaces the configured sizing bets (33%, 75%) as
// check/bet33/bet75, EXCLUDING the all-in (amount ≈ stack) and folding its small
// frequency into the largest surfaced bucket so per-label freqs still sum to ~1.
// Flop has two sizing bets → 3 actions; turn/river have one → 2 actions.
const SIZE_TAGS = ['bet33', 'bet75']
const SIZE_FRAC = [0.33, 0.75]
const ALLIN_MIN = 25 // bb: any single bet at/above this is the jam, not a sizing
function aggregate(node) {
  const { actions, strategy } = node.strategy
  const checkIdx = actions.indexOf('CHECK')
  const bets = actions
    .map((a, i) => ({ i, amt: parseFloat(a.split(' ')[1]) }))
    .filter((x) => actions[x.i].startsWith('BET'))
    .sort((p, q) => p.amt - q.amt)
  const sizing = bets.filter((b) => b.amt < ALLIN_MIN).slice(0, SIZE_TAGS.length)
  const allinIdxs = bets.filter((b) => !sizing.includes(b)).map((b) => b.i)
  const outActions = ['check', ...sizing.map((_, k) => SIZE_TAGS[k])]
  const betSizes = sizing.map((_, k) => SIZE_FRAC[k])
  const lastCol = outActions.length - 1 // fold the jam into the biggest sizing bucket
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
  for (const [lab, v] of acc) out[lab] = v.sums.map((s) => round(s / v.n))
  return { actions: outActions, betSizes, strategy: out }
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

function buildNodes(board, tree) {
  const nodes = []
  const flopIp = tree.childrens?.CHECK // BTN facing BB's flop check (the c-bet node)
  if (!flopIp?.strategy) return nodes
  const toks = boardTokens(board)

  // FLOP — two bet sizes
  const agg = aggregate(flopIp)
  nodes.push(
    baseNode(board, 'flop', {
      history: ['BTN opens 2.5bb', 'BB calls'],
      betSizes: agg.betSizes,
      actions: agg.actions,
      strategy: agg.strategy,
    }),
  )

  // smallest BET child = the 33% c-bet line we follow into the turn
  const betKeys = Object.keys(flopIp.childrens ?? {})
    .filter((k) => k.startsWith('BET'))
    .sort((a, b) => parseFloat(a.split(' ')[1]) - parseFloat(b.split(' ')[1]))
  const smallBet = betKeys[0]
  const turnSrc = smallBet && flopIp.childrens[smallBet]?.childrens?.CALL // BB calls the small c-bet
  if (turnSrc?.dealcards) {
    Object.keys(turnSrc.dealcards)
      .slice(0, 8)
      .forEach((rawCard) => {
        const tc = normaliseCard(rawCard)
        const turnIp = turnSrc.dealcards[rawCard]?.childrens?.CHECK
        if (!turnIp?.strategy) return
        const turnBoard = board + tc
        const ta = aggregate(turnIp)
        nodes.push(
          baseNode(turnBoard, 'turn', {
            history: ['BTN opens 2.5bb', 'BB calls', `Flop: ${toks.join(' ')}`, 'BB checks', 'BTN bets 1.8bb', 'BB calls'],
            betSizes: ta.betSizes,
            actions: ta.actions,
            strategy: ta.strategy,
          }),
        )
      })
  }

  // TURN — check-check line (both checked the flop)
  if (flopIp.childrens?.CHECK?.dealcards) {
    const cc = flopIp.childrens.CHECK
    Object.keys(cc.dealcards)
      .slice(0, 8)
      .forEach((rawCard) => {
        const tc = normaliseCard(rawCard)
        const oop = cc.dealcards[rawCard]?.childrens?.CHECK // OOP checks turn → IP faces check
        if (!oop?.strategy) return
        const ta = aggregate(oop)
        nodes.push(
          baseNode(board + tc, 'turn', {
            history: ['BTN opens 2.5bb', 'BB calls', `Flop: ${toks.join(' ')}`, 'BB checks', 'BTN checks back'],
            betSizes: ta.betSizes,
            actions: ta.actions,
            strategy: ta.strategy,
          }),
        )
      })
  }
  return nodes
}

function buildInput(board, outName) {
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
set_bet_sizes ip,flop,bet,33
set_bet_sizes ip,flop,bet,75
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
set_thread_num 8
set_accuracy 0.5
set_max_iteration 90
set_print_interval 30
set_use_isomorphism 1
start_solve
set_dump_rounds 2
dump_result ${outName}
`
}

export { buildNodes, aggregate, BOARDS, VALIDATION_BOARDS }

// Only run the solve batch when executed directly (not when imported by a test).
if (!process.argv[1]?.endsWith('solve-boards.mjs')) {
  // imported as a module — skip the batch
} else {
// ---- run ----
const mode = process.argv[2] ?? 'full'
const boards = mode === 'validate' ? VALIDATION_BOARDS : BOARDS

let accum = existsSync(ACC) ? JSON.parse(readFileSync(ACC, 'utf8')) : []
const have = new Set(accum.filter((n) => n.street === 'flop').map((n) => n.board))

for (const board of boards) {
  if (have.has(board)) {
    console.log(`skip ${board} (already extracted)`)
    continue
  }
  const inName = `solve_${board}.txt`
  const outName = `solve_${board}_result.json`
  const inPath = join(INSTALL, inName)
  const outPath = join(INSTALL, outName)
  writeFileSync(inPath, buildInput(board, outName))
  console.log(`=== solving ${board} ===`)
  const t0 = Date.now()
  const logName = `solve_${board}.log`
  try {
    // Match the proven run-boards.sh invocation: shell + stdout/stderr to a log file.
    execSync(`./console_solver -i ${inName} > ${logName} 2>&1`, { cwd: INSTALL, stdio: 'ignore' })
  } catch (e) {
    console.error(`solve failed for ${board} (exit ${e.status}). Log tail:`)
    try {
      console.error(execSync(`tail -5 ${join(INSTALL, logName)}`).toString())
    } catch {}
    continue
  }
  if (!existsSync(outPath)) {
    console.error(`no dump produced for ${board}`)
    continue
  }
  const tree = JSON.parse(readFileSync(outPath, 'utf8'))
  const nodes = buildNodes(board, tree)
  accum.push(...nodes)
  writeFileSync(ACC, JSON.stringify(accum))
  rmSync(outPath, { force: true }) // reclaim ~150MB before the next board
  rmSync(inPath, { force: true })
  const secs = Math.round((Date.now() - t0) / 1000)
  console.log(`  -> ${nodes.length} nodes in ${secs}s (${board})`)
}

// Write flop+turn+river-less corpus. River nodes are re-added by transform-rivers.mjs.
accum.sort((a, b) => a.board.localeCompare(b.board) || a.street.localeCompare(b.street))
writeFileSync(OUT, JSON.stringify(accum, null, 2) + '\n')
const by = accum.reduce((m, n) => ((m[n.street] = (m[n.street] || 0) + 1), m), {})
console.log(`\nwrote ${accum.length} nodes -> ${OUT}`, by)
}
