// All-seats SRP solver batch. Loops every opener-vs-BB matchup × board, with TWO
// bet sizes on flop, turn AND river, thread-throttled for a quiet Mac, resumable
// per matchup. Extracts the rich node set (IP c-bet, OOP donk, OOP facing a c-bet,
// turn lines) via transform-allseats.
//
//   node solver-spike/solve-allseats.mjs --test            # ONE board, keep dump, print
//   node solver-spike/solve-allseats.mjs                   # full batch, 4 threads
//   node solver-spike/solve-allseats.mjs --threads=6       # dial the power
//
// MUST be run on a real machine — console_solver wedges in the agent sandbox.
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { MATCHUPS } from './build-ranges-all.mjs'
import { extractNodes } from './transform-allseats.mjs'
import { BOARDS } from './solve-boards.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const INSTALL = '/Users/danwilloughby/Documents/Code Projects/TexasSolver/install'
const boardTokens = (b) => b.match(/../g)

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`))
  return m ? m.split('=')[1] : d
}
const THREADS = Number(arg('threads', '4')) // medium power by default
const STACK = arg('stack', '97.5') // shallower stack → much smaller tree
// How many bet sizes per street (memory grows fast with street count of 2 sizes):
//   lite (default) = 2 on flop only        → fits 16 GB comfortably, full variety
//   mid            = 2 on flop + turn       → bigger; needs ~more RAM or a shallow stack
//   rich           = 2 on flop+turn+river   → OOMs at 100 bb on 16 GB (use --stack=50)
const SIZES = arg('sizes', 'lite')
const TWO = { lite: ['flop'], mid: ['flop', 'turn'], rich: ['flop', 'turn', 'river'] }[SIZES] ?? ['flop']
const TEST = process.argv.includes('--test')

function buildInput(m, board, outName) {
  const cb = boardTokens(board).join(',')
  const sizes = ['flop', 'turn', 'river']
    .flatMap((s) => {
      const bet = TWO.includes(s) ? '33,75' : '33' // two sizes only where affordable
      return [
        `set_bet_sizes oop,${s},bet,${bet}`,
        `set_bet_sizes oop,${s},raise,75`,
        `set_bet_sizes oop,${s},allin`,
        `set_bet_sizes ip,${s},bet,${bet}`,
        `set_bet_sizes ip,${s},raise,75`,
        `set_bet_sizes ip,${s},allin`,
      ]
    })
    .join('\n')
  return `set_pot 5.5
set_effective_stack ${STACK}
set_board ${cb}
set_range_ip ${m.ip}
set_range_oop ${m.oop}
${sizes}
set_allin_threshold 0.67
build_tree
set_thread_num ${THREADS}
set_accuracy 0.5
set_max_iteration 90
set_print_interval 30
set_use_isomorphism 1
start_solve
set_dump_rounds 2
dump_result ${outName}
`
}

function solveOne(m, board, keepDump) {
  const inName = `as_${m.id}_${board}.txt`
  const outName = `as_${m.id}_${board}_result.json`
  const inPath = join(INSTALL, inName)
  const outPath = join(INSTALL, outName)
  writeFileSync(inPath, buildInput(m, board, outName))
  const logName = `as_${m.id}_${board}.log`
  console.log(`=== solving ${m.id} ${board} (${THREADS} threads, sizes=${SIZES}, stack=${STACK}) ===`)
  const t0 = Date.now()
  try {
    execSync(`./console_solver -i ${inName} > ${logName} 2>&1`, { cwd: INSTALL, stdio: 'ignore' })
  } catch (e) {
    const oom = e.status === 137
    console.error(`solve failed for ${m.id} ${board} (exit ${e.status}${oom ? ' = out of memory' : ''}). Log tail:`)
    try {
      console.error(execSync(`tail -5 "${join(INSTALL, logName)}"`).toString())
    } catch {}
    if (oom) {
      console.error(
        `\n✗ OOM at sizes=${SIZES}, stack=${STACK}. This will fail every board — stopping.\n` +
          `  Re-run lighter:  node solver-spike/solve-allseats.mjs${SIZES === 'rich' ? ' --sizes=mid' : SIZES === 'mid' ? '' : ' --stack=50'}`,
      )
      process.exit(2)
    }
    return null
  }
  if (!existsSync(outPath)) {
    console.error(`no dump produced for ${m.id} ${board}`)
    return null
  }
  const tree = JSON.parse(readFileSync(outPath, 'utf8'))
  const nodes = extractNodes(m.opener, board, tree)
  const secs = Math.round((Date.now() - t0) / 1000)
  console.log(`  -> ${nodes.length} nodes in ${secs}s`)
  if (!keepDump) {
    rmSync(outPath, { force: true })
    rmSync(inPath, { force: true })
  }
  return { nodes, outPath }
}

if (TEST) {
  // de-risk: solve one board, keep the dump, show what extraction found
  const m = MATCHUPS.find((x) => x.opener === 'CO') ?? MATCHUPS[0]
  const board = BOARDS[0]
  const res = solveOne(m, board, true)
  if (!res) process.exit(1)
  const by = res.nodes.reduce((a, n) => ((a[`${n.street}/${n.kind}/${n.hero}`] = (a[`${n.street}/${n.kind}/${n.hero}`] || 0) + 1), a), {})
  console.log('\nextracted node types:', by)
  for (const kind of ['donk', 'cbet', 'face_cbet']) {
    const n = res.nodes.find((x) => x.kind === kind && x.street === 'flop')
    if (!n) {
      console.log(`⚠ no flop ${kind} node — tree shape differs, send me ${res.outPath}`)
      continue
    }
    const lab = Object.keys(n.strategy).find((l) => ['AA', 'AKs', 'KQs'].includes(l)) ?? Object.keys(n.strategy)[0]
    console.log(`  ${kind} (${n.hero}): actions ${JSON.stringify(n.actions)} | ${lab} = ${JSON.stringify(n.strategy[lab])}`)
  }
  console.log(`\nraw dump kept at: ${res.outPath}\nPaste this output back to me to confirm the schema before the full run.`)
} else {
  for (const m of MATCHUPS) {
    const accFile = join(here, `.accum-${m.id}.json`)
    let accum = existsSync(accFile) ? JSON.parse(readFileSync(accFile, 'utf8')) : []
    const have = new Set(accum.filter((n) => n.street === 'flop' && n.kind === 'cbet').map((n) => n.board))
    for (const board of BOARDS) {
      if (have.has(board)) {
        console.log(`skip ${m.id} ${board} (done)`)
        continue
      }
      const res = solveOne(m, board, false)
      if (!res) continue
      accum.push(...res.nodes)
      writeFileSync(accFile, JSON.stringify(accum))
    }
    console.log(`\n✓ ${m.id}: ${accum.length} nodes -> ${accFile}`)
  }
  console.log('\nAll matchups done. Next: a finalize step merges the accums into the app dataset.')
}
