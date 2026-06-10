/* LeakTutor — one-page investor summary (portrait letter) */
const pptxgen = require('pptxgenjs')

const C = {
  felt: '173129',
  feltHi: '1F4438',
  ink: '23201A',
  sage: '6E8B7B',
  sageDk: '40543F',
  cream: 'F4EFE4',
  clay: 'C2674A',
  gold: 'D7A24B',
  muted: '6E6552',
  creamMuted: 'C9BCA0',
  line: 'D8CDB9',
}
const HEAD = 'Georgia'
const BODY = 'Calibri'

const p = new pptxgen()
p.defineLayout({ name: 'LETTER_P', width: 8.5, height: 11 })
p.layout = 'LETTER_P'
p.author = 'LeakTutor'
p.title = 'LeakTutor — Investor One-Pager'

const W = 8.5,
  M = 0.55
const s = p.addSlide()
s.background = { color: C.cream }

const shadow = () => ({ type: 'outer', color: '000000', blur: 7, offset: 2, angle: 135, opacity: 0.16 })

// ---- header band -----------------------------------------------------------
s.addShape(p.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 2.35, fill: { color: C.felt } })
s.addText([{ text: '♠  ', options: { color: C.gold } }, { text: 'LeakTutor', options: { color: C.cream } }], {
  x: M, y: 0.32, w: 5, h: 0.4, fontSize: 16, bold: true, fontFace: HEAD, margin: 0,
})
s.addText('INVESTOR ONE-PAGER · 2026', {
  x: W - 3.5, y: 0.36, w: 3.5 - M, h: 0.35, align: 'right', fontSize: 9.5, bold: true, color: C.creamMuted, charSpacing: 2, fontFace: BODY, margin: 0,
})
s.addText('Fix the leaks that cost you the pot.', {
  x: M, y: 0.8, w: W - 2 * M, h: 0.75, fontSize: 30, bold: true, color: C.cream, fontFace: HEAD, margin: 0,
})
s.addText(
  'A personalized GTO poker trainer that finds your specific mistakes — and drills them away. Live, installable, fully offline.',
  { x: M, y: 1.65, w: W - 2 * M, h: 0.55, fontSize: 12, color: C.creamMuted, fontFace: BODY, margin: 0 },
)

// ---- section helper --------------------------------------------------------
function label(x, y, w, text) {
  s.addText(text.toUpperCase(), { x, y, w, h: 0.26, fontSize: 10.5, bold: true, color: C.clay, charSpacing: 2, fontFace: BODY, margin: 0 })
}
function para(x, y, w, h, text) {
  s.addText(text, { x, y, w, h, fontSize: 10.5, color: C.ink, fontFace: BODY, lineSpacingMultiple: 1.04, margin: 0, valign: 'top' })
}
function bullets(x, y, w, h, items, color) {
  s.addText(
    items.map((t, i) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: i < items.length - 1, color: color || C.ink } })),
    { x, y, w, h, fontSize: 10.5, fontFace: BODY, paraSpaceAfter: 4, margin: 0, valign: 'top' },
  )
}

// ---- Problem / Solution (full width) --------------------------------------
label(M, 2.6, 5, 'The problem')
para(M, 2.86, W - 2 * M, 0.62,
  'Poker training is generic — vast theory libraries where players grind abstract spots, never the hands they actually misplay. Most can’t name the three decisions quietly costing them the most money, so they never fix them.')

label(M, 3.62, 5, 'The solution')
para(M, 3.88, W - 2 * M, 0.82,
  'LeakTutor turns your own play into a fix-list: bring your hands (drill live or import a history) → see your top leaks, auto-detected → drill the exact fix, with a plain-English “why” on every hand. Not another spot library — a coach that knows your game.')

// ---- two columns: Moat / Product ------------------------------------------
const colW = (W - 2 * M - 0.4) / 2
const rx = M + colW + 0.4
label(M, 4.92, colW, 'Why it’s defensible')
bullets(M, 5.18, colW, 1.5, [
  'Real solver strategy (open-source TexasSolver), precomputed & offline — credible GTO at zero server cost.',
  'Leak detection → targeted drilling: the personalization wedge incumbents don’t nail.',
  'Installable PWA + beginner→intermediate path widens the funnel beyond grinders.',
])
label(rx, 4.92, colW, 'Product — built & live')
bullets(rx, 5.18, colW, 1.5, [
  'GTO-correct scoring, incl. mixed frequencies.',
  'Plain-English explanations on every hand.',
  'Auto leak tracker → one-tap targeted drills.',
  'Spaced-repetition review + daily streaks.',
])

// ---- Market & model (full width) ------------------------------------------
label(M, 6.95, 6, 'Market & model')
para(M, 7.21, W - 2 * M, 0.9,
  '100M+ people play online poker; open-source solvers make credible content cheap; PWAs unlock mobile-first training. Freemium: free preflop + leak tracking; premium adds the full postflop corpus + bet-sizing, unlimited imports + postflop leak reports, and cloud sync. Content is solved once and reused forever → marginal cost per user ≈ $0.')

// ---- stat row --------------------------------------------------------------
const stats = [
  ['Live', 'PWA shipped'],
  ['4', 'drill modes'],
  ['Real', 'solver data'],
  ['100%', 'offline'],
]
const sw = (W - 2 * M - 0.3 * 3) / 4
stats.forEach(([big, lab], i) => {
  const x = M + i * (sw + 0.3)
  s.addShape(p.shapes.RECTANGLE, { x, y: 8.2, w: sw, h: 0.78, fill: { color: 'FFFFFF' }, shadow: shadow() })
  s.addText(big, { x, y: 8.28, w: sw, h: 0.42, align: 'center', fontSize: 21, bold: true, color: C.clay, fontFace: HEAD, margin: 0 })
  s.addText(lab, { x, y: 8.68, w: sw, h: 0.26, align: 'center', fontSize: 9, color: C.muted, fontFace: BODY, margin: 0 })
})

// ---- The ask box -----------------------------------------------------------
s.addShape(p.shapes.RECTANGLE, { x: M, y: 9.2, w: W - 2 * M, h: 1.15, fill: { color: C.felt }, shadow: shadow() })
s.addShape(p.shapes.RECTANGLE, { x: M, y: 9.2, w: 0.1, h: 1.15, fill: { color: C.gold } })
s.addText([{ text: 'THE ASK   ', options: { color: C.gold, bold: true, fontSize: 11, charSpacing: 1 } }], {
  x: M + 0.35, y: 9.34, w: 4, h: 0.3, fontFace: BODY, margin: 0,
})
s.addText(
  [
    { text: 'Raising $[ — ] (pre-seed)', options: { bold: true, color: C.cream } },
    { text: ' to fund content depth (~45%), growth (~35%) and team (~20%). Milestones: launch premium, reach [ — ] active users, prove monthly retention.', options: { color: C.creamMuted } },
  ],
  { x: M + 0.35, y: 9.64, w: W - 2 * M - 0.7, h: 0.66, fontSize: 11, fontFace: BODY, lineSpacingMultiple: 1.04, margin: 0, valign: 'top' },
)

// ---- contact footer --------------------------------------------------------
s.addText(
  [
    { text: 'daniel-willoughby.github.io/GTO-leak-fixer', options: { color: C.sageDk, bold: true } },
    { text: '     ·     [ Founder name · email · phone ]', options: { color: C.muted } },
  ],
  { x: M, y: 10.5, w: W - 2 * M, h: 0.3, fontSize: 10, fontFace: BODY, align: 'center', margin: 0 },
)

p.writeFile({ fileName: 'LeakTutor-One-Pager.pptx' }).then(() => console.log('WROTE LeakTutor-One-Pager.pptx'))
