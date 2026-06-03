// Extended transform: extract flop + a sample of turn nodes from each solve.
// Outputs src/data/street-nodes.json — an array of StreetNode[]
//
// Node path extracted:
//   root                        = OOP (BB) flop check/bet
//   root.CHECK                  = IP (BTN) c-bet vs check  ← FLOP node
//   root.CHECK.BET 2.0          = OOP facing BTN c-bet
//   root.CHECK.BET 2.0.CALL     = chance node (deal turn)
//   root.CHECK.BET 2.0.CALL.dealcards.<turnCard>.CHECK  = IP vs OOP check on TURN
//
// We also grab IP facing a check-back:
//   root.CHECK.CHECK            = OOP check-behind (both checked flop)
//   root.CHECK.CHECK.dealcards.<turnCard>.CHECK = IP on TURN after check-check
//
// Usage: node solver-spike/transform-multistreet.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const INSTALL = '/Users/danwilloughby/Documents/Code Projects/TexasSolver/install'
const OUT = join(here, '..', 'src', 'data', 'street-nodes.json')

const RANKS = 'AKQJT98765432'
const round = (x) => Math.round(x * 1000) / 1000

function label169(combo) {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}

function aggregateStrategy(node) {
  const { actions, strategy } = node.strategy
  const betIdxs = actions.map((a, i) => (a.startsWith('BET') || a.startsWith('RAISE') ? i : -1)).filter((i) => i >= 0)
  const checkIdx = actions.indexOf('CHECK')
  const acc = new Map()
  for (const [combo, freqs] of Object.entries(strategy)) {
    const lab = label169(combo)
    const bet = betIdxs.reduce((s, i) => s + freqs[i], 0)
    const cur = acc.get(lab) ?? { check: 0, bet: 0, n: 0 }
    cur.check += freqs[checkIdx]
    cur.bet += bet
    cur.n += 1
    acc.set(lab, cur)
  }
  const out = {}
  for (const [lab, v] of acc) out[lab] = [round(v.check / v.n), round(v.bet / v.n)]
  return out
}

function boardFromFile(name) {
  const m = name.match(/((?:[AKQJT2-9][shdc]){3})_result\.json$/)
  return m ? m[1] : null
}

// Parse a board string like "Qs7h2c" into card tokens ["Qs","7h","2c"]
function boardTokens(b) {
  const t = []
  for (let i = 0; i + 1 < b.length; i += 2) t.push(b.slice(i, i + 2))
  return t
}

// Normalise a TexasSolver turn-card key to rank+suit, e.g. "Ah" → "Ah"
function normaliseCard(raw) {
  return raw.replace(/[^AKQJTakqjt2-9shdc]/g, '').slice(0, 2)
}

function buildNodes(board, tree) {
  const nodes = []

  // --- FLOP: BTN c-bet facing check ---
  const flopIpNode = tree.childrens?.CHECK
  if (!flopIpNode?.strategy) return nodes
  nodes.push({
    spot: 'BTN_vs_BB_SRP',
    board,
    street: 'flop',
    heroAction: 'none', // hero is about to act for the first time on this street
    history: [`BTN opens 2.5bb`, `BB calls`],
    potType: 'srp',
    hero: 'BTN',
    villain: 'BB',
    facing: 'check',
    betSizes: [0.33],
    actions: ['check', 'bet33'],
    strategy: aggregateStrategy(flopIpNode),
    meta: { solver: 'TexasSolver', generatedAt: new Date().toISOString().slice(0, 10), approximate: false },
  })

  const betKey = (node) => Object.keys(node?.childrens ?? {}).find((k) => k.startsWith('BET'))

  // --- TURN (bet line): BTN bet flop, BB called, now BTN faces BB check on turn ---
  const flopBetNode = flopIpNode.childrens?.['BET 2.000000']
  const flopCallNode = flopBetNode?.childrens?.['CALL']
  if (flopCallNode?.dealcards) {
    const boardToks = boardTokens(board)
    const turnCards = Object.keys(flopCallNode.dealcards).slice(0, 8)
    turnCards.forEach((rawCard, ti) => {
      const tc = normaliseCard(rawCard)
      const turnNode = flopCallNode.dealcards[rawCard]
      const turnIpNode = turnNode?.childrens?.CHECK
      if (!turnIpNode?.strategy) return
      const turnBoard = board + tc
      nodes.push({
        spot: 'BTN_vs_BB_SRP',
        board: turnBoard,
        street: 'turn',
        heroAction: 'none',
        history: [`BTN opens 2.5bb`, `BB calls`, `Flop: ${boardToks.join(' ')}`, `BB checks`, `BTN bets 1.8bb`, `BB calls`],
        potType: 'srp',
        hero: 'BTN',
        villain: 'BB',
        facing: 'check',
        betSizes: [0.33],
        actions: ['check', 'bet33'],
        strategy: aggregateStrategy(turnIpNode),
        meta: { solver: 'TexasSolver', generatedAt: new Date().toISOString().slice(0, 10), approximate: false },
      })

      // --- RIVER (bounded: first 3 turns × first 3 rivers) ---
      if (ti >= 3) return
      const turnBetK = betKey(turnIpNode)
      const turnCallNode = turnBetK && turnIpNode.childrens[turnBetK]?.childrens?.['CALL']
      if (!turnCallNode?.dealcards) return
      Object.keys(turnCallNode.dealcards).slice(0, 3).forEach((rawRiver) => {
        const rc = normaliseCard(rawRiver)
        const riverIpNode = turnCallNode.dealcards[rawRiver]?.childrens?.CHECK
        if (!riverIpNode?.strategy) return
        nodes.push({
          spot: 'BTN_vs_BB_SRP',
          board: turnBoard + rc,
          street: 'river',
          heroAction: 'none',
          history: [`BTN opens 2.5bb`, `BB calls`, `Flop: ${boardToks.join(' ')}`, `BB checks`, `BTN bets 1.8bb`, `BB calls`, `Turn: ${tc}`, `BB checks`, `BTN bets`, `BB calls`, `River: ${rc}`],
          potType: 'srp',
          hero: 'BTN',
          villain: 'BB',
          facing: 'check',
          betSizes: [0.33],
          actions: ['check', 'bet33'],
          strategy: aggregateStrategy(riverIpNode),
          meta: { solver: 'TexasSolver', generatedAt: new Date().toISOString().slice(0, 10), approximate: false },
        })
      })
    })
  }

  // --- TURN (check-check line): both checked flop, BTN faces check on turn ---
  const flopCheckCheckNode = flopIpNode.childrens?.CHECK
  if (flopCheckCheckNode?.dealcards) {
    const boardToks = boardTokens(board)
    const turnCards = Object.keys(flopCheckCheckNode.dealcards).slice(0, 8)
    for (const rawCard of turnCards) {
      const tc = normaliseCard(rawCard)
      const turnNode = flopCheckCheckNode.dealcards[rawCard]
      // OOP acts first; find the CHECK child (OOP checks) → IP facing check
      const oopFirstNode = turnNode?.childrens?.CHECK
      if (!oopFirstNode?.strategy) continue
      const fullBoard = board + tc
      nodes.push({
        spot: 'BTN_vs_BB_SRP',
        board: fullBoard,
        street: 'turn',
        heroAction: 'none',
        history: [`BTN opens 2.5bb`, `BB calls`, `Flop: ${boardToks.join(' ')}`, `BB checks`, `BTN checks back`],
        potType: 'srp',
        hero: 'BTN',
        villain: 'BB',
        facing: 'check',
        betSizes: [0.33],
        actions: ['check', 'bet33'],
        strategy: aggregateStrategy(oopFirstNode),
        meta: { solver: 'TexasSolver', generatedAt: new Date().toISOString().slice(0, 10), approximate: false },
      })
    }
  }

  return nodes
}

const files = readdirSync(INSTALL).filter((f) => f.endsWith('_result.json') && boardFromFile(f))
const allNodes = []
for (const f of files) {
  const board = boardFromFile(f)
  console.log(`processing ${board}...`)
  const tree = JSON.parse(readFileSync(join(INSTALL, f), 'utf8'))
  const nodes = buildNodes(board, tree)
  allNodes.push(...nodes)
  console.log(`  -> ${nodes.length} nodes (1 flop + ${nodes.length - 1} turns)`)
}
allNodes.sort((a, b) => a.board.localeCompare(b.board))
writeFileSync(OUT, JSON.stringify(allNodes, null, 2) + '\n')
console.log(`\nwrote ${allNodes.length} total nodes -> ${OUT}`)
