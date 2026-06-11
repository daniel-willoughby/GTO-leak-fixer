// Richer extraction from a TexasSolver SRP dump. Where the old transform pulled
// only the IP c-bet node, this pulls the variety that makes Freeplay feel alive:
//   - IP c-bet            (opener faces BB's check: check / bet⅓ / bet¾)
//   - OOP donk            (BB acts first on the flop: check / bet⅓ / bet¾)
//   - OOP facing a c-bet  (BB checked, opener bet: fold / call / raise)   ← react-to-bet
// plus the turn continuations of those lines. Tree shape (from the proven transform):
//   tree                         = BB flop decision (donk node)
//   tree.childrens.CHECK         = opener c-bet node
//   …CHECK.childrens['BET x']    = BB facing the c-bet
//   …CHECK.childrens.CHECK.dealcards[turn].childrens.CHECK = turn (both checked)
//
// CLI (test-board verification — prints what it found, doesn't write data):
//   node solver-spike/transform-allseats.mjs <dump.json> <OPENER> <board6>

import { readFileSync } from 'node:fs'

const RANKS = 'AKQJT98765432'
const round = (x) => Math.round(x * 1000) / 1000
const today = () => new Date().toISOString().slice(0, 10)
const boardTokens = (b) => b.match(/../g)
const normaliseCard = (raw) => raw.replace(/[^AKQJTakqjt2-9shdc]/g, '').slice(0, 2)
const label169 = (combo) => {
  const a = combo.slice(0, 2)
  const b = combo.slice(2)
  if (a[0] === b[0]) return a[0] + b[0]
  const [hi, lo] = RANKS.indexOf(a[0]) < RANKS.indexOf(b[0]) ? [a, b] : [b, a]
  return hi[0] + lo[0] + (a[1] === b[1] ? 's' : 'o')
}

const SIZE_TAGS = ['bet33', 'bet75']
const SIZE_FRAC = [0.33, 0.75]
const ALLIN_MIN = 25

const betChild = (node) =>
  Object.keys(node?.childrens ?? {})
    .filter((k) => k.startsWith('BET'))
    .sort((a, b) => parseFloat(a.split(' ')[1]) - parseFloat(b.split(' ')[1]))[0]

/** check / bet⅓ / bet¾ aggregation (a node whose actions are CHECK + BETs). */
function aggregateBet(node) {
  const { actions, strategy } = node.strategy
  const checkIdx = actions.indexOf('CHECK')
  if (checkIdx < 0) return null
  const bets = actions
    .map((a, i) => ({ i, amt: parseFloat(a.split(' ')[1]) }))
    .filter((x) => actions[x.i].startsWith('BET'))
    .sort((p, q) => p.amt - q.amt)
  const sizing = bets.filter((b) => b.amt < ALLIN_MIN).slice(0, SIZE_TAGS.length)
  const allinIdxs = bets.filter((b) => !sizing.includes(b)).map((b) => b.i)
  const outActions = ['check', ...sizing.map((_, k) => SIZE_TAGS[k])]
  const last = outActions.length - 1
  const acc = new Map()
  for (const [combo, freqs] of Object.entries(strategy)) {
    const lab = label169(combo)
    const row = acc.get(lab) ?? { sums: new Array(outActions.length).fill(0), n: 0 }
    row.sums[0] += freqs[checkIdx] ?? 0
    sizing.forEach((b, k) => (row.sums[k + 1] += freqs[b.i] ?? 0))
    allinIdxs.forEach((i) => (row.sums[last] += freqs[i] ?? 0))
    row.n += 1
    acc.set(lab, row)
  }
  const out = {}
  for (const [lab, v] of acc) out[lab] = v.sums.map((s) => round(s / v.n))
  return { actions: outActions, betSizes: sizing.map((_, k) => SIZE_FRAC[k]), strategy: out }
}

/** fold / call / raise aggregation (a node facing a bet — all raises collapse). */
function aggregateFacing(node) {
  const { actions, strategy } = node.strategy
  const foldIdx = actions.indexOf('FOLD')
  const callIdx = actions.indexOf('CALL')
  const raiseIdxs = actions.map((a, i) => (a.startsWith('RAISE') || a.startsWith('ALLIN') ? i : -1)).filter((i) => i >= 0)
  if (foldIdx < 0 || callIdx < 0) return null
  const out = {}
  const acc = new Map()
  for (const [combo, freqs] of Object.entries(strategy)) {
    const lab = label169(combo)
    const row = acc.get(lab) ?? { f: 0, c: 0, r: 0, n: 0 }
    row.f += freqs[foldIdx] ?? 0
    row.c += freqs[callIdx] ?? 0
    raiseIdxs.forEach((i) => (row.r += freqs[i] ?? 0))
    row.n += 1
    acc.set(lab, row)
  }
  for (const [lab, v] of acc) out[lab] = [round(v.f / v.n), round(v.c / v.n), round(v.r / v.n)]
  return { actions: ['fold', 'call', 'raise'], betSizes: [], strategy: out }
}

const node = (opener, board, street, kind, hero, facing, agg, history) => ({
  spot: `${opener}_vs_BB_SRP`,
  board,
  street,
  kind, // 'cbet' | 'donk' | 'face_cbet'
  hero, // 'IP' (the opener) | 'OOP' (the BB)
  facing, // 'check' | 'bet'
  potType: 'srp',
  meta: { solver: 'TexasSolver', generatedAt: today(), approximate: false },
  history,
  betSizes: agg.betSizes,
  actions: agg.actions,
  strategy: agg.strategy,
})

/** Extract every node type we can from one flop dump tree. */
export function extractNodes(opener, board, tree) {
  const out = []
  const toks = boardTokens(board)
  const pre = [`${opener} opens 2.5bb`, 'BB calls', `Flop: ${toks.join(' ')}`]

  // 1) OOP donk — BB acts first on the flop
  if (tree?.strategy) {
    const a = aggregateBet(tree)
    if (a) out.push(node(opener, board, 'flop', 'donk', 'OOP', 'check', a, [`${opener} opens 2.5bb`, 'BB calls', `Flop: ${toks.join(' ')}`]))
  }

  const ip = tree?.childrens?.CHECK // opener facing BB's check = c-bet node
  if (ip?.strategy) {
    // 2) IP c-bet
    const a = aggregateBet(ip)
    if (a) out.push(node(opener, board, 'flop', 'cbet', 'IP', 'check', a, [...pre, 'BB checks']))

    // 3) OOP facing a c-bet — BB checked, opener bet, BB must respond
    const bk = betChild(ip)
    const faceFlop = bk ? ip.childrens[bk] : null
    if (faceFlop?.strategy) {
      const a2 = aggregateFacing(faceFlop)
      if (a2) out.push(node(opener, board, 'flop', 'face_cbet', 'OOP', 'bet', a2, [...pre, 'BB checks', `${opener} bets`]))
    }

    // 4) turn (IP) on the bet→call line, plus turn (IP) on the check-check line
    const turnSrc = bk ? ip.childrens[bk]?.childrens?.CALL : null
    addTurns(out, opener, board, turnSrc, [...pre, 'BB checks', `${opener} bets`, 'BB calls'])
    addTurns(out, opener, board, ip.childrens?.CHECK, [...pre, 'BB checks', `${opener} checks back`], true)
  }
  return out
}

function addTurns(out, opener, board, src, history, checkLine = false) {
  if (!src?.dealcards) return
  for (const raw of Object.keys(src.dealcards).slice(0, 8)) {
    const tc = normaliseCard(raw)
    const turnIp = src.dealcards[raw]?.childrens?.CHECK // BB checks turn → opener acts
    if (!turnIp?.strategy) continue
    const a = aggregateBet(turnIp)
    if (a) out.push(node(opener, board + tc, 'turn', 'cbet', 'IP', 'check', a, [...history, `Turn: ${tc}`, 'BB checks']))
    // OOP facing the turn bet
    const bk = betChild(turnIp)
    const face = bk ? turnIp.childrens[bk] : null
    if (face?.strategy) {
      const a2 = aggregateFacing(face)
      if (a2) out.push(node(opener, board + tc, 'turn', 'face_cbet', 'OOP', 'bet', a2, [...history, `Turn: ${tc}`, 'BB checks', `${opener} bets`]))
    }
  }
}

// ---- CLI: inspect a real dump (the test-board verification) -----------------
if (process.argv[1]?.endsWith('transform-allseats.mjs')) {
  const [file, opener, board] = process.argv.slice(2)
  if (!file || !opener || !board) {
    console.error('usage: node transform-allseats.mjs <dump.json> <OPENER> <board6>')
    process.exit(1)
  }
  const tree = JSON.parse(readFileSync(file, 'utf8'))
  const nodes = extractNodes(opener, board, tree)
  const by = nodes.reduce((m, n) => ((m[`${n.street}/${n.kind}/${n.hero}`] = (m[`${n.street}/${n.kind}/${n.hero}`] || 0) + 1), m), {})
  console.log(`extracted ${nodes.length} nodes:`, by)
  for (const kind of ['donk', 'cbet', 'face_cbet']) {
    const n = nodes.find((x) => x.kind === kind && x.street === 'flop')
    if (!n) {
      console.log(`\n⚠ no flop ${kind} node found — tree shape may differ, send me the dump`)
      continue
    }
    const lab = Object.keys(n.strategy).find((l) => ['AA', 'AKs', 'KQs'].includes(l)) ?? Object.keys(n.strategy)[0]
    console.log(`\n${n.kind} (${n.hero}, facing ${n.facing}) — actions ${JSON.stringify(n.actions)}`)
    console.log(`  ${lab}: ${JSON.stringify(n.strategy[lab])}`)
  }
}
