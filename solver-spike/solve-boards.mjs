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

// 400-board set: a texture-representative, even sample of the 1755 strategically-
// distinct flops, sized so the low-power batch (~15 min/board) runs ~4 days on 8
// cores. Originals first (row 1-3) so their existing river data still lines up in
// finalize; the rest are canonical reps from gen-all-flops.mjs. New boards get
// flop+turn only; river stays on the originals.
const BOARDS = [
  'As8c3h', 'Ah7d2c', 'Ad9c4h', 'KsTh5d', 'Kc8d3s', 'Ks9h4c', 'Qs7h2c', 'Qd9c5h', 'Jc8d3h', 'Td7c2s',
  'KsQh7c', 'AsKd9h', 'QsJh8c', 'JsTd6c', '9h8h4c', 'Jd7d2s', 'Ts9s5d', '8d7d3c', '7h6d5c', '6s5h4d',
  '5s4d3h', '9c7d4s', 'Td8c5h', 'AsAd7c', 'KsKh4c', '8s8d3h', '2s2d9h', 'AhKh4h', 'Qs8s4s', 'Th9h6h',
  'AhAdAc', 'AdAcQh', 'AdAc9c', 'AdAc7c', 'AdAc4c', 'AdAc2h', 'AcKcJc', 'AcKc9d', 'AcKc6c', 'AcKc4d',
  'AcKhKd', 'AcKdJd', 'AcKdTh', 'AcKd8h', 'AcKd6d', 'AcKd5h', 'AcKd3d', 'AcQdQc', 'AcQcTd', 'AcQc7c',
  'AcQc5d', 'AcQc3d', 'AcQdJd', 'AcQd9c', 'AcQd8d', 'AcQd6c', 'AcQd5h', 'AcQd3c', 'AcQd2h', 'AcJc9d',
  'AcJc7d', 'AcJc4c', 'AcJc2d', 'AcJdTh', 'AcJd8d', 'AcJd6c', 'AcJd5d', 'AcJd3c', 'AcJd2h', 'AcTc8c',
  'AcTc6d', 'AcTc3c', 'AcThTd', 'AcTd8d', 'AcTd6c', 'AcTd5d', 'AcTd3c', 'AcTd2h', 'Ac9c7c', 'Ac9c5d',
  'Ac9c2c', 'Ac9d8d', 'Ac9d6c', 'Ac9d5h', 'Ac9d3d', 'Ac8d8c', 'Ac8c5c', 'Ac8c3c', 'Ac8d7c', 'Ac8d6h',
  'Ac8d4c', 'Ac8d2c', 'Ac7c6d', 'Ac7c4d', 'Ac7h7d', 'Ac7d5d', 'Ac7d4h', 'Ac7d2d', 'Ac6c4d', 'Ac6c2d',
  'Ac6d4c', 'Ac6d3h', 'Ac5d5c', 'Ac5c2c', 'Ac5d4h', 'Ac5d2c', 'Ac4c3d', 'Ac4d3c', 'Ac4d2h', 'Ac3d2c',
  'Ac2h2d', 'KdKcJh', 'KdKc8c', 'KdKc6c', 'KdKc3c', 'KcQcJc', 'KcQc9c', 'KcQc7d', 'KcQc4c', 'KcQc2c',
  'KcQdJh', 'KcQd9d', 'KcQd8h', 'KcQd6h', 'KcQd4d', 'KcQd3h', 'KcJcTc', 'KcJc8d', 'KcJc6d', 'KcJc3c',
  'KcJdTc', 'KcJd9d', 'KcJd7c', 'KcJd6h', 'KcJd4c', 'KcJd3h', 'KcTc9c', 'KcTc7c', 'KcTc5d', 'KcTc2c',
  'KcTd9d', 'KcTd7c', 'KcTd6h', 'KcTd4d', 'KcTd2c', 'Kc9c8d', 'Kc9c6d', 'Kc9c3c', 'Kc9d8c', 'Kc9d7d',
  'Kc9d5c', 'Kc9d3c', 'Kc9d2d', 'Kc8c6c', 'Kc8c4d', 'Kc8c2d', 'Kc8d6c', 'Kc8d5h', 'Kc8d3c', 'Kc7d7c',
  'Kc7c4c', 'Kc7c2c', 'Kc7d6h', 'Kc7d4d', 'Kc7d3h', 'Kc6c5c', 'Kc6c3d', 'Kc6d5c', 'Kc6d4h', 'Kc6d2d',
  'Kc5c4d', 'Kc5h5d', 'Kc5d3d', 'Kc5d2h', 'Kc4c2d', 'Kc4d2c', 'Kc3c2c', 'Kc3d2h', 'QdQcJh', 'QdQc9h',
  'QdQc6c', 'QdQc4c', 'QdQc2h', 'QcJc9d', 'QcJc7d', 'QcJc4c', 'QcJc2d', 'QcJdTh', 'QcJd8d', 'QcJd6d',
  'QcJd5h', 'QcJd3d', 'QcTdTc', 'QcTc8d', 'QcTc5c', 'QcTc3d', 'QcTd9c', 'QcTd8h', 'QcTd6d', 'QcTd5h',
  'QcTd3d', 'Qc9d9c', 'Qc9c7d', 'Qc9c4c', 'Qc9c2d', 'Qc9d8h', 'Qc9d6d', 'Qc9d4d', 'Qc9d3h', 'Qc8c7c',
  'Qc8c5d', 'Qc8c2c', 'Qc8d7h', 'Qc8d5d', 'Qc8d4h', 'Qc8d2d', 'Qc7c5c', 'Qc7c3c', 'Qc7d6c', 'Qc7d5h',
  'Qc7d3c', 'Qc6d6c', 'Qc6c3c', 'Qc6h6d', 'Qc6d4d', 'Qc6d2c', 'Qc5c4c', 'Qc5c2d', 'Qc5d3c', 'Qc5d2d',
  'Qc4c2c', 'Qc4d3h', 'Qc3d3c', 'Qc3d2d', 'JdJcTc', 'JdJc8c', 'JdJc6h', 'JdJc3c', 'JcTdTc', 'JcTc7c',
  'JcTc5d', 'JcTc3d', 'JcTd9d', 'JcTd7c', 'JcTd6d', 'JcTd4d', 'JcTd2c', 'Jc9c8c', 'Jc9c6d', 'Jc9c3c',
  'Jc9h9d', 'Jc9d7d', 'Jc9d5c', 'Jc9d4d', 'Jc9d2c', 'Jc8c7c', 'Jc8c5d', 'Jc8c2c', 'Jc8d7d', 'Jc8d5c',
  'Jc8d4h', 'Jc8d2d', 'Jc7c5c', 'Jc7c3d', 'Jc7d6d', 'Jc7d4c', 'Jc7d3h', 'Jc6d6c', 'Jc6c3c', 'Jc6d5c',
  'Jc6d4d', 'Jc6d2c', 'Jc5c4d', 'Jc5c2d', 'Jc5d3c', 'Jc5d2h', 'Jc4c2c', 'Jc4d3h', 'Jc3c2c', 'Jc3d2d',
  'TdTc9c', 'TdTc7h', 'TdTc5h', 'TdTc2c', 'Tc9c7c', 'Tc9c4c', 'Tc9c2d', 'Tc9d7c', 'Tc9d6d', 'Tc9d4c',
  'Tc9d3h', 'Tc8d8c', 'Tc8c5c', 'Tc8c3d', 'Tc8d7c', 'Tc8d6h', 'Tc8d4h', 'Tc8d2c', 'Tc7c6d', 'Tc7c3c',
  'Tc7h7d', 'Tc7d5d', 'Tc7d3c', 'Tc7d2d', 'Tc6c4d', 'Tc6h6d', 'Tc6d4c', 'Tc6d3h', 'Tc5c4c', 'Tc5c2c',
  'Tc5d4h', 'Tc5d2d', 'Tc4c3d', 'Tc4d3d', 'Tc3d3c', 'Tc3d2c', '9h9d9c', '9d9c6c', '9d9c4c', '9d9c2h',
  '9c8c6d', '9c8c3c', '9c8d7c', '9c8d6h', '9c8d4c', '9c8d3h', '9c7c6c', '9c7c4c', '9c7c2d', '9c7d6h',
  '9c7d4d', '9c7d2d', '9c6c5d', '9c6c2c', '9c6d5h', '9c6d3c', '9c6d2h', '9c5c3d', '9c5d4c', '9c5d3h',
  '9c4c3c', '9c4h4d', '9c4d2d', '9c3h3d', '9c2d2c', '8d8c6h', '8d8c3c', '8c7c6c', '8c7c4d', '8c7d6c',
  '8c7d5d', '8c7d3c', '8c7d2h', '8c6c4c', '8c6c2d', '8c6d4c', '8c6d3d', '8c5d5c', '8c5c2c', '8c5d4d',
  '8c5d2c', '8c4c3d', '8c4d3c', '8c4d2h', '8c3d2c', '8c2h2d', '7d7c5h', '7d7c2c', '7c6c5d', '7c6c2c',
  '7c6d4c', '7c6d3d', '7c5d5c', '7c5c2c', '7c5d4d', '7c5d2c', '7c4c3d', '7c4d3c', '7c4d2h', '7c3d2c',
  '7c2h2d', '6d6c4h', '6c5d5c', '6c5c3d', '6c5d4d', '6c5d2d', '6c4c3d', '6c4d3d', '6c3d3c', '6c3d2c',
  '5h5d5c', '5d5c2c', '5c4c3d', '5c4d3d', '5c3c2c', '5c3d2d', '4d4c3c', '4c3c2c', '4c3d2d', '3d3c2c',
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
      console.error(execSync(`tail -5 "${join(INSTALL, logName)}"`).toString())
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
