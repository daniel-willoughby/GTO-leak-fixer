/* LeakTutor — investor pitch deck generator (pptxgenjs) */
const pptxgen = require('pptxgenjs')
const React = require('react')
const ReactDOMServer = require('react-dom/server')
const sharp = require('sharp')
const fa = require('react-icons/fa6')

// ---- palette (the app's warm "Zen" brand) ----------------------------------
const FELT = '14312420'.slice(0, 6) // unused guard
const C = {
  felt: '173129', // deep poker-felt green (dark bg)
  feltHi: '1F4438',
  ink: '23201A', // warm near-black
  sage: '6E8B7B',
  sageDk: '40543F',
  cream: 'F4EFE4', // light bg
  paper2: 'EAE2D2',
  clay: 'C2674A', // terracotta accent
  gold: 'D7A24B', // stat accent
  line: 'D8CDB9',
  muted: '7C miss', // placeholder, set below
}
C.muted = '6E6552'
C.creamMuted = 'C9BCA0'
const HEAD = 'Georgia'
const BODY = 'Calibri'

// ---- icon rasterizer -------------------------------------------------------
async function icon(IconComponent, color = '#23201A', size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) }),
  )
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return 'image/png;base64,' + png.toString('base64')
}

async function main() {
  const I = {}
  const need = {
    book: fa.FaBookOpen,
    eyeSlash: fa.FaEyeSlash,
    chart: fa.FaChartLine,
    upload: fa.FaArrowUpFromBracket,
    target: fa.FaBullseye,
    wrench: fa.FaWrench,
    server: fa.FaServer,
    plane: fa.FaPlaneUp,
    cap: fa.FaGraduationCap,
    check: fa.FaCircleCheck,
    comment: fa.FaCommentDots,
    bolt: fa.FaBolt,
    fire: fa.FaFire,
    list: fa.FaListCheck,
    unlock: fa.FaLockOpen,
    crown: fa.FaCrown,
    cloud: fa.FaCloud,
    infinity: fa.FaInfinity,
    rocket: fa.FaRocket,
    database: fa.FaDatabase,
    mobile: fa.FaMobileScreenButton,
    layers: fa.FaLayerGroup,
    users: fa.FaUsers,
    spade: fa.FaSpadeSolid || fa.FaSpade,
    bullhorn: fa.FaBullhorn,
    seedling: fa.FaSeedling,
    handshake: fa.FaHandshake,
  }
  for (const [k, comp] of Object.entries(need)) {
    if (!comp) continue
    I[k] = {
      ink: await icon(comp, '#23201A'),
      cream: await icon(comp, '#F4EFE4'),
      sage: await icon(comp, '#6E8B7B'),
      gold: await icon(comp, '#D7A24B'),
      clay: await icon(comp, '#C2674A'),
      felt: await icon(comp, '#173129'),
    }
  }

  const p = new pptxgen()
  p.layout = 'LAYOUT_WIDE' // 13.3 x 7.5
  p.author = 'LeakTutor'
  p.title = 'LeakTutor — Investor Overview'
  const W = 13.3,
    H = 7.5,
    M = 0.7

  const shadow = () => ({ type: 'outer', color: '000000', blur: 9, offset: 3, angle: 135, opacity: 0.18 })

  // circle-backed icon
  function chip(s, x, y, d, glyph, circle, glyphColor) {
    s.addShape(p.shapes.OVAL, { x, y, w: d, h: d, fill: { color: circle }, shadow: shadow() })
    const ip = d * 0.46
    s.addImage({ data: glyph[glyphColor], x: x + (d - ip) / 2, y: y + (d - ip) / 2, w: ip, h: ip })
  }

  function footer(s, dark) {
    const col = dark ? C.creamMuted : C.muted
    s.addText(
      [
        { text: '♠  ', options: { color: dark ? C.gold : C.sage } },
        { text: 'LeakTutor', options: { color: col, bold: true } },
        { text: '   ·   Investor overview · 2026', options: { color: col } },
      ],
      { x: M, y: H - 0.5, w: 8, h: 0.3, fontSize: 9, fontFace: BODY, align: 'left', margin: 0 },
    )
  }
  function kicker(s, text, color) {
    s.addText(text.toUpperCase(), {
      x: M, y: 0.62, w: W - 2 * M, h: 0.3, fontSize: 12, bold: true, color, fontFace: BODY, charSpacing: 3, margin: 0,
    })
  }
  function title(s, text, color, y = 0.98) {
    s.addText(text, { x: M, y, w: W - 2 * M, h: 0.9, fontSize: 34, bold: true, color, fontFace: HEAD, margin: 0 })
  }

  // =========================================================== 1. COVER
  {
    const s = p.addSlide()
    s.background = { color: C.felt }
    // motif: faint card suits row
    s.addText('♠   ♥   ♦   ♣', {
      x: W - 5.2, y: 0.5, w: 4.5, h: 0.5, align: 'right', fontSize: 18, color: C.feltHi, fontFace: BODY,
    })
    s.addText(
      [{ text: '♠  ', options: { color: C.gold } }, { text: 'LeakTutor', options: { color: C.cream } }],
      { x: M, y: 1.5, w: 8, h: 0.6, fontSize: 22, bold: true, fontFace: HEAD, margin: 0 },
    )
    s.addText('Fix the leaks that\ncost you the pot.', {
      x: M, y: 2.5, w: 10.5, h: 2.0, fontSize: 52, bold: true, color: C.cream, fontFace: HEAD, lineSpacingMultiple: 0.98, margin: 0,
    })
    s.addText(
      'A personalized GTO poker trainer that finds your specific mistakes — and drills them away. Live, installable, fully offline.',
      { x: M, y: 4.7, w: 9.2, h: 0.9, fontSize: 17, color: C.creamMuted, fontFace: BODY, margin: 0 },
    )
    s.addShape(p.shapes.RECTANGLE, { x: M, y: 5.9, w: 3.0, h: 0.04, fill: { color: C.gold } })
    s.addText('Investor Overview', {
      x: M, y: 6.05, w: 8, h: 0.4, fontSize: 13, color: C.gold, bold: true, fontFace: BODY, charSpacing: 2, margin: 0,
    })
    s.addText('daniel-willoughby.github.io/GTO-leak-fixer', {
      x: M, y: 6.45, w: 9, h: 0.4, fontSize: 12, color: C.creamMuted, fontFace: BODY, margin: 0,
    })
  }

  // =========================================================== 2. PROBLEM
  {
    const s = p.addSlide()
    s.background = { color: C.cream }
    kicker(s, 'The problem', C.clay)
    title(s, 'Players study endlessly — and bleed the same spots.', C.ink)
    const rows = [
      ['book', 'Training is generic', 'Today’s tools are vast theory libraries. You grind abstract spots — never the hands you actually misplay.'],
      ['eyeSlash', 'No feedback loop', 'Most players can’t name the three decisions quietly costing them the most money. So they never fix them.'],
      ['chart', 'Theory ≠ results', 'Solvers are intimidating, online-only, and built for pros. Knowledge rarely converts into better play at the table.'],
    ]
    let y = 2.35
    for (const [ic, h, body] of rows) {
      chip(s, M, y, 0.95, I[ic], C.clay, 'cream')
      s.addText(h, { x: M + 1.25, y: y - 0.04, w: 6.2, h: 0.5, fontSize: 19, bold: true, color: C.ink, fontFace: HEAD, margin: 0 })
      s.addText(body, { x: M + 1.25, y: y + 0.46, w: 6.4, h: 0.8, fontSize: 14, color: C.muted, fontFace: BODY, margin: 0 })
      y += 1.55
    }
    // right pull-quote card
    s.addShape(p.shapes.RECTANGLE, { x: 8.7, y: 2.35, w: 3.9, h: 4.0, fill: { color: C.felt }, shadow: shadow() })
    s.addShape(p.shapes.RECTANGLE, { x: 8.7, y: 2.35, w: 0.09, h: 4.0, fill: { color: C.gold } })
    s.addText('“', { x: 9.0, y: 2.4, w: 1, h: 1, fontSize: 60, color: C.gold, fontFace: HEAD, bold: true, margin: 0 })
    s.addText('Millions play online; most lose. The gap is rarely knowledge — it’s unfixed habits.', {
      x: 9.1, y: 3.5, w: 3.2, h: 2.2, fontSize: 19, color: C.cream, fontFace: HEAD, italic: true, margin: 0, valign: 'top',
    })
    footer(s, false)
  }

  // =========================================================== 3. SOLUTION
  {
    const s = p.addSlide()
    s.background = { color: C.felt }
    kicker(s, 'The solution', C.gold)
    title(s, 'LeakTutor turns your own play into a fix-list.', C.cream)
    s.addText('Not another spot library. A coach that knows your game.', {
      x: M, y: 1.85, w: 11, h: 0.5, fontSize: 17, italic: true, color: C.gold, fontFace: HEAD, margin: 0,
    })
    const steps = [
      ['upload', '1 · Bring your hands', 'Drill live spots or import your hand history — no setup, no spreadsheets.'],
      ['target', '2 · See your top leaks', 'LeakTutor auto-detects the exact positions and hand types you misplay most.'],
      ['wrench', '3 · Drill the fix', 'One tap launches a targeted drill for that leak — with a plain-English “why” on every hand.'],
    ]
    const cw = 3.7,
      gap = 0.42,
      startX = (W - (cw * 3 + gap * 2)) / 2
    steps.forEach(([ic, h, body], i) => {
      const x = startX + i * (cw + gap)
      s.addShape(p.shapes.RECTANGLE, { x, y: 2.75, w: cw, h: 3.4, fill: { color: C.feltHi }, shadow: shadow() })
      chip(s, x + 0.4, 3.1, 0.95, I[ic], C.gold, 'felt')
      s.addText(h, { x: x + 0.4, y: 4.2, w: cw - 0.8, h: 0.5, fontSize: 18, bold: true, color: C.cream, fontFace: HEAD, margin: 0 })
      s.addText(body, { x: x + 0.4, y: 4.75, w: cw - 0.8, h: 1.3, fontSize: 14, color: C.creamMuted, fontFace: BODY, margin: 0 })
      if (i < 2)
        s.addText('→', { x: x + cw - 0.05, y: 4.2, w: gap + 0.1, h: 0.6, align: 'center', fontSize: 24, color: C.gold, bold: true, margin: 0 })
    })
    footer(s, true)
  }

  // =========================================================== 4. PRODUCT
  {
    const s = p.addSlide()
    s.background = { color: C.cream }
    kicker(s, 'The product', C.sage)
    title(s, 'A drill loop that feels like a coach, not a textbook.', C.ink)
    // left: stylized app mock (drawn)
    const mx = M,
      my = 2.3,
      mw = 4.3,
      mh = 4.4
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: mx, y: my, w: mw, h: mh, fill: { color: C.ink }, rectRadius: 0.18, shadow: shadow() })
    // felt table
    s.addShape(p.shapes.OVAL, { x: mx + 0.5, y: my + 0.45, w: mw - 1.0, h: 2.0, fill: { color: C.feltHi }, line: { color: C.sage, width: 1.5 } })
    // hole cards
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: mx + 1.55, y: my + 1.15, w: 0.55, h: 0.78, fill: { color: C.cream }, rectRadius: 0.06 })
    s.addText('A♠', { x: mx + 1.55, y: my + 1.15, w: 0.55, h: 0.78, align: 'center', valign: 'middle', fontSize: 13, bold: true, color: C.ink, fontFace: BODY, margin: 0 })
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: mx + 2.2, y: my + 1.15, w: 0.55, h: 0.78, fill: { color: C.cream }, rectRadius: 0.06 })
    s.addText('K♥', { x: mx + 2.2, y: my + 1.15, w: 0.55, h: 0.78, align: 'center', valign: 'middle', fontSize: 13, bold: true, color: C.clay, fontFace: BODY, margin: 0 })
    // decision buttons
    const by = my + 2.7
    ;[['Fold', C.feltHi], ['Call', C.sage], ['Raise', C.gold]].forEach(([t, col], i) => {
      const bx = mx + 0.45 + i * 1.15
      s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: bx, y: by, w: 1.0, h: 0.5, fill: { color: col }, rectRadius: 0.08 })
      s.addText(t, { x: bx, y: by, w: 1.0, h: 0.5, align: 'center', valign: 'middle', fontSize: 12, bold: true, color: col === C.feltHi ? C.cream : C.ink, fontFace: BODY, margin: 0 })
    })
    // feedback strip
    s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: mx + 0.45, y: by + 0.75, w: mw - 0.9, h: 0.85, fill: { color: C.sage }, rectRadius: 0.08 })
    s.addText('✓  Raise — correct. A♠K♥ opens 100% from the button; folding here forfeits value.', {
      x: mx + 0.6, y: by + 0.8, w: mw - 1.2, h: 0.75, fontSize: 10.5, color: C.ink, fontFace: BODY, valign: 'middle', margin: 0,
    })
    // right: features
    const feats = [
      ['check', 'GTO-correct answers', 'Real solver strategy, scored instantly — including mixed frequencies.'],
      ['comment', 'Plain-English “why”', 'Every decision is explained the way a coach would, not a solver dump.'],
      ['list', 'Leak tracker', 'Auto-aggregates your mistakes by position and hand type.'],
      ['bolt', 'One-tap targeted drills', 'Jump straight from a leak into the spots that fix it.'],
      ['fire', 'Daily challenge + streaks', 'A habit loop that brings players back day after day.'],
    ]
    let fy = 2.35
    for (const [ic, h, body] of feats) {
      chip(s, 5.5, fy, 0.62, I[ic], C.sage, 'cream')
      s.addText(h, { x: 6.32, y: fy - 0.06, w: 6.3, h: 0.4, fontSize: 16, bold: true, color: C.ink, fontFace: HEAD, margin: 0 })
      s.addText(body, { x: 6.32, y: fy + 0.32, w: 6.4, h: 0.5, fontSize: 12.5, color: C.muted, fontFace: BODY, margin: 0 })
      fy += 0.92
    }
    footer(s, false)
  }

  // =========================================================== 5. MOAT
  {
    const s = p.addSlide()
    s.background = { color: C.cream }
    kicker(s, 'Why it’s defensible', C.clay)
    title(s, 'The moat: personalization on top of real solver data.', C.ink)
    const cards = [
      ['server', 'Solver data, precomputed', 'GTO strategy from an open-source solver, baked into the app — credible answers with zero server cost.'],
      ['target', 'Leak-fixing, not browsing', 'Detecting your weaknesses and drilling them is the wedge incumbents don’t do well.'],
      ['plane', 'Offline-first PWA', 'Installs like an app, works on a plane, no app-store tax. Train anywhere.'],
      ['cap', 'Beginner → intermediate', 'A guided curriculum widens the funnel past hardcore grinders to the much larger learner market.'],
    ]
    const cw = 5.75,
      ch = 1.9,
      gx = 0.45,
      gy = 0.4,
      x0 = M,
      y0 = 2.35
    cards.forEach(([ic, h, body], i) => {
      const x = x0 + (i % 2) * (cw + gx)
      const y = y0 + Math.floor(i / 2) * (ch + gy)
      s.addShape(p.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: 'FFFFFF' }, shadow: shadow() })
      s.addShape(p.shapes.RECTANGLE, { x, y, w: 0.09, h: ch, fill: { color: C.sage } })
      chip(s, x + 0.35, y + 0.42, 0.8, I[ic], C.sage, 'cream')
      s.addText(h, { x: x + 1.35, y: y + 0.3, w: cw - 1.6, h: 0.45, fontSize: 17, bold: true, color: C.ink, fontFace: HEAD, margin: 0 })
      s.addText(body, { x: x + 1.35, y: y + 0.78, w: cw - 1.6, h: 1.0, fontSize: 13, color: C.muted, fontFace: BODY, margin: 0 })
    })
    footer(s, false)
  }

  // =========================================================== 6. DIFFERENTIATION
  {
    const s = p.addSlide()
    s.background = { color: C.felt }
    kicker(s, 'Competitive landscape', C.gold)
    title(s, 'Everyone teaches theory. We fix your game.', C.cream)
    const head = (t, hl) => ({
      text: t,
      options: { fill: { color: hl ? C.gold : C.feltHi }, color: hl ? C.ink : C.cream, bold: true, align: 'center', valign: 'middle', fontSize: 13, fontFace: BODY },
    })
    const rowLabel = (t) => ({ text: t, options: { fill: { color: C.feltHi }, color: C.cream, bold: true, align: 'left', valign: 'middle', fontSize: 12.5, fontFace: BODY } })
    const cell = (yes, hl) => ({
      text: yes === true ? '●' : yes === false ? '—' : yes,
      options: {
        fill: { color: hl ? '20493B' : '1A382E' },
        color: yes === true ? (hl ? C.gold : C.sage) : yes === false ? C.creamMuted : C.cream,
        align: 'center', valign: 'middle', fontSize: yes === true || yes === false ? 16 : 11.5, bold: hl, fontFace: BODY,
      },
    })
    const rows = [
      [head(''), head('GTO Wizard'), head('Generic trainers'), head('1-on-1 coaching'), head('LeakTutor', true)],
      [rowLabel('Personalized to your leaks'), cell(false), cell(false), cell(true), cell(true, true)],
      [rowLabel('Plain-English coaching'), cell('Partial'), cell(false), cell(true), cell(true, true)],
      [rowLabel('Works fully offline'), cell(false), cell(false), cell('—'), cell(true, true)],
      [rowLabel('Beginner-friendly path'), cell('Partial'), cell(true), cell(true), cell(true, true)],
      [rowLabel('Always-on & affordable'), cell(true), cell(true), cell(false), cell(true, true)],
    ]
    s.addTable(rows, {
      x: M, y: 2.4, w: W - 2 * M, h: 4.0, colW: [3.3, 2.15, 2.15, 2.15, 2.15],
      rowH: [0.62, 0.62, 0.62, 0.62, 0.62, 0.62], border: { type: 'solid', pt: 1, color: C.felt }, valign: 'middle',
    })
    s.addText('●  = strong   ·   —  = weak / absent', { x: M, y: 6.55, w: 8, h: 0.3, fontSize: 10, italic: true, color: C.creamMuted, fontFace: BODY, margin: 0 })
    footer(s, true)
  }

  // =========================================================== 7. MARKET
  {
    const s = p.addSlide()
    s.background = { color: C.cream }
    kicker(s, 'Market & timing', C.sage)
    title(s, 'A large, paying audience — and the tech just got cheap.', C.ink)
    // three "why now" points
    const now = [
      ['users', 'Big base', '100M+ people play online poker worldwide, and the study-tool habit keeps growing.'],
      ['server', 'Cheap solvers', 'Open-source solvers make credible GTO content affordable to produce — no compute moat needed to start.'],
      ['mobile', 'Mobile-first', 'PWAs + offline play unlock training on the device players actually carry.'],
    ]
    let x = M
    for (const [ic, h, body] of now) {
      s.addShape(p.shapes.RECTANGLE, { x, y: 2.3, w: 3.85, h: 1.95, fill: { color: 'FFFFFF' }, shadow: shadow() })
      chip(s, x + 0.32, 2.6, 0.7, I[ic], C.clay, 'cream')
      s.addText(h, { x: x + 1.15, y: 2.62, w: 2.6, h: 0.45, fontSize: 16, bold: true, color: C.ink, fontFace: HEAD, margin: 0 })
      s.addText(body, { x: x + 0.32, y: 3.35, w: 3.25, h: 0.85, fontSize: 12, color: C.muted, fontFace: BODY, margin: 0 })
      x += 4.07
    }
    // TAM / SAM / SOM bars
    const bands = [
      ['TAM', 'Global poker training & study spend', '$[ — ] B', 11.2],
      ['SAM', 'English-speaking online cash & MTT students', '$[ — ] M', 8.0],
      ['SOM', 'Reachable in 18 mo via poker communities', '$[ — ] M', 4.8],
    ]
    let by = 4.55
    for (const [t, d, v, bw] of bands) {
      s.addShape(p.shapes.RECTANGLE, { x: M, y: by, w: bw, h: 0.62, fill: { color: t === 'TAM' ? C.sage : t === 'SAM' ? C.sageDk : C.clay } })
      s.addText(`${t}`, { x: M + 0.2, y: by, w: 1.2, h: 0.62, valign: 'middle', fontSize: 14, bold: true, color: C.cream, fontFace: HEAD, margin: 0 })
      s.addText(d, { x: M + 1.4, y: by, w: bw - 2.6, h: 0.62, valign: 'middle', fontSize: 11.5, color: C.cream, fontFace: BODY, margin: 0 })
      s.addText(v, { x: M + bw - 1.5, y: by, w: 1.4, h: 0.62, valign: 'middle', align: 'right', fontSize: 14, bold: true, color: C.cream, fontFace: BODY, margin: 0 })
      by += 0.72
    }
    s.addText('Sizing is a framework — drop in your segment figures. Player-base anchor is an industry estimate.', {
      x: M, y: 6.85, w: 11, h: 0.3, fontSize: 10, italic: true, color: C.muted, fontFace: BODY, margin: 0,
    })
    footer(s, false)
  }

  // =========================================================== 8. BUSINESS MODEL
  {
    const s = p.addSlide()
    s.background = { color: C.felt }
    kicker(s, 'Business model', C.gold)
    title(s, 'Freemium subscription, near-zero marginal cost.', C.cream)
    // free column
    s.addShape(p.shapes.RECTANGLE, { x: M, y: 2.4, w: 5.5, h: 3.7, fill: { color: C.feltHi }, shadow: shadow() })
    chip(s, M + 0.4, 2.7, 0.7, I.unlock, C.sage, 'felt')
    s.addText('Free', { x: M + 1.25, y: 2.72, w: 4, h: 0.5, fontSize: 20, bold: true, color: C.cream, fontFace: HEAD, margin: 0 })
    s.addText('The hook — get value in 30 seconds', { x: M + 1.25, y: 3.18, w: 4.1, h: 0.4, fontSize: 12, italic: true, color: C.creamMuted, fontFace: BODY, margin: 0 })
    s.addText(
      [
        { text: 'Full preflop GTO trainer', options: { bullet: true, breakLine: true } },
        { text: 'Sample postflop spots', options: { bullet: true, breakLine: true } },
        { text: 'Leak tracking + daily streak', options: { bullet: true, breakLine: true } },
        { text: 'Beginner learning path', options: { bullet: true } },
      ],
      { x: M + 0.5, y: 3.75, w: 4.7, h: 2.1, fontSize: 14, color: C.cream, fontFace: BODY, paraSpaceAfter: 8, margin: 0 },
    )
    // premium column (highlighted)
    const px = M + 5.9
    s.addShape(p.shapes.RECTANGLE, { x: px, y: 2.4, w: 5.7, h: 3.7, fill: { color: 'FFFFFF' }, shadow: shadow() })
    s.addShape(p.shapes.RECTANGLE, { x: px, y: 2.4, w: 5.7, h: 0.12, fill: { color: C.gold } })
    chip(s, px + 0.4, 2.72, 0.7, I.crown, C.gold, 'felt')
    s.addText('Premium', { x: px + 1.25, y: 2.74, w: 4, h: 0.5, fontSize: 20, bold: true, color: C.ink, fontFace: HEAD, margin: 0 })
    s.addText('from $[ — ]/mo · illustrative', { x: px + 1.25, y: 3.2, w: 4.2, h: 0.4, fontSize: 12, italic: true, color: C.clay, fontFace: BODY, margin: 0 })
    s.addText(
      [
        { text: 'Full postflop corpus + bet-sizing', options: { bullet: true, breakLine: true } },
        { text: 'Unlimited hand-history imports', options: { bullet: true, breakLine: true } },
        { text: 'Postflop leak reports + study plans', options: { bullet: true, breakLine: true } },
        { text: 'Cloud sync across devices', options: { bullet: true } },
      ],
      { x: px + 0.5, y: 3.75, w: 4.9, h: 2.1, fontSize: 14, color: C.ink, fontFace: BODY, paraSpaceAfter: 8, margin: 0 },
    )
    // econ note
    s.addShape(p.shapes.RECTANGLE, { x: M, y: 6.2, w: W - 2 * M, h: 0.62, fill: { color: '20493B' } })
    s.addText(
      [
        { text: 'Unit economics:  ', options: { bold: true, color: C.gold } },
        { text: 'content is solved once and reused forever → marginal cost per user ≈ $0 and gross margins scale like classic software.', options: { color: C.cream } },
      ],
      { x: M + 0.3, y: 6.2, w: W - 2 * M - 0.6, h: 0.62, valign: 'middle', fontSize: 12.5, fontFace: BODY, margin: 0 },
    )
    footer(s, true)
  }

  // =========================================================== 9. TRACTION
  {
    const s = p.addSlide()
    s.background = { color: C.cream }
    kicker(s, 'Traction', C.sage)
    title(s, 'The product is built and live. Next: users.', C.ink)
    const stats = [
      ['Live', 'PWA shipped & installable'],
      ['4', 'drill modes: open, vs-raise, multiway, postflop'],
      ['Real', 'TexasSolver-validated strategy data'],
      ['100%', 'offline-capable, no backend required'],
    ]
    let x = M
    for (const [big, lab] of stats) {
      s.addShape(p.shapes.RECTANGLE, { x, y: 2.3, w: 2.85, h: 1.7, fill: { color: 'FFFFFF' }, shadow: shadow() })
      s.addText(big, { x, y: 2.45, w: 2.85, h: 0.8, align: 'center', fontSize: 40, bold: true, color: C.clay, fontFace: HEAD, margin: 0 })
      s.addText(lab, { x: x + 0.2, y: 3.25, w: 2.45, h: 0.7, align: 'center', fontSize: 11.5, color: C.muted, fontFace: BODY, margin: 0 })
      x += 3.0
    }
    // built list
    s.addText('Already engineered', { x: M, y: 4.35, w: 6, h: 0.4, fontSize: 15, bold: true, color: C.sageDk, fontFace: HEAD, margin: 0 })
    s.addText(
      [
        { text: 'Preflop GTO ranges (RFI, vs-RFI, multiway / squeeze)', options: { bullet: true, breakLine: true } },
        { text: 'Postflop bet-sizing wired (Check / Bet ⅓ / Bet ¾)', options: { bullet: true, breakLine: true } },
        { text: 'Auto leak tracker → one-tap targeted drilling', options: { bullet: true, breakLine: true } },
        { text: 'Spaced-repetition review of missed spots', options: { bullet: true } },
      ],
      { x: M, y: 4.75, w: 6.0, h: 1.9, fontSize: 13.5, color: C.ink, fontFace: BODY, paraSpaceAfter: 7, margin: 0 },
    )
    // right callout card
    s.addShape(p.shapes.RECTANGLE, { x: 7.4, y: 4.35, w: 5.2, h: 2.3, fill: { color: C.felt }, shadow: shadow() })
    chip(s, 7.75, 4.7, 0.7, I.rocket, C.gold, 'felt')
    s.addText('De-risked: the hard part is done', { x: 8.6, y: 4.72, w: 3.7, h: 0.5, fontSize: 15, bold: true, color: C.cream, fontFace: HEAD, margin: 0 })
    s.addText('A credible, offline GTO product already exists and works. Capital goes to growth and content depth — not proving feasibility.', {
      x: 7.75, y: 5.45, w: 4.5, h: 1.1, fontSize: 12.5, color: C.creamMuted, fontFace: BODY, margin: 0,
    })
    footer(s, false)
  }

  // =========================================================== 10. ROADMAP
  {
    const s = p.addSlide()
    s.background = { color: C.felt }
    kicker(s, 'Roadmap', C.gold)
    title(s, 'From working product to growing business.', C.cream)
    const phases = [
      ['seedling', 'Now', 'Substance', 'Expand the postflop corpus — more boards, bet-sizing, 3-bet pots.'],
      ['target', 'Next', 'Retention', 'Postflop leak reports, structured study plans, challenges.'],
      ['cloud', 'Then', 'Reach', 'Accounts + cloud sync, mobile polish, social leaderboards.'],
      ['handshake', 'Later', 'Monetize', 'Premium tier at scale + B2B for coaches and poker sites.'],
    ]
    const cw = 2.85,
      gap = 0.32,
      x0 = M
    // connecting line
    s.addShape(p.shapes.LINE, { x: x0 + 0.5, y: 3.05, w: (cw + gap) * 3, h: 0, line: { color: C.feltHi, width: 3 } })
    phases.forEach(([ic, when, h, body], i) => {
      const x = x0 + i * (cw + gap)
      chip(s, x + cw / 2 - 0.45, 2.6, 0.9, I[ic], i === 0 ? C.gold : C.sage, 'felt')
      s.addText(when.toUpperCase(), { x, y: 3.65, w: cw, h: 0.3, align: 'center', fontSize: 11, bold: true, color: C.gold, charSpacing: 2, fontFace: BODY, margin: 0 })
      s.addText(h, { x, y: 3.95, w: cw, h: 0.45, align: 'center', fontSize: 19, bold: true, color: C.cream, fontFace: HEAD, margin: 0 })
      s.addShape(p.shapes.RECTANGLE, { x: x + 0.15, y: 4.55, w: cw - 0.3, h: 1.7, fill: { color: C.feltHi } })
      s.addText(body, { x: x + 0.35, y: 4.7, w: cw - 0.7, h: 1.45, fontSize: 12.5, color: C.creamMuted, fontFace: BODY, valign: 'top', margin: 0 })
    })
    footer(s, true)
  }

  // =========================================================== 11. THE ASK
  {
    const s = p.addSlide()
    s.background = { color: C.cream }
    kicker(s, 'The ask', C.clay)
    title(s, 'Raising $[ — ] to turn a product into momentum.', C.ink)
    s.addText('Pre-seed · use of funds over the next 12–18 months', {
      x: M, y: 1.85, w: 11, h: 0.4, fontSize: 14, italic: true, color: C.muted, fontFace: HEAD, margin: 0,
    })
    const buckets = [
      ['database', 'Content depth', '~45%', 'Expand the solver corpus across boards, sizings and pot types — the substance that justifies premium.'],
      ['bullhorn', 'Growth', '~35%', 'Acquisition through poker communities, creators and content; convert free users to paid.'],
      ['users', 'Team', '~20%', 'A second engineer and part-time poker content lead to ship faster.'],
    ]
    let x = M
    for (const [ic, h, pct, body] of buckets) {
      s.addShape(p.shapes.RECTANGLE, { x, y: 2.5, w: 3.85, h: 2.9, fill: { color: 'FFFFFF' }, shadow: shadow() })
      s.addShape(p.shapes.RECTANGLE, { x, y: 2.5, w: 3.85, h: 0.1, fill: { color: C.clay } })
      chip(s, x + 0.35, 2.85, 0.75, I[ic], C.clay, 'cream')
      s.addText(pct, { x: x + 1.3, y: 2.82, w: 2.4, h: 0.6, align: 'right', fontSize: 26, bold: true, color: C.clay, fontFace: HEAD, margin: 0 })
      s.addText(h, { x: x + 0.35, y: 3.75, w: 3.2, h: 0.4, fontSize: 17, bold: true, color: C.ink, fontFace: HEAD, margin: 0 })
      s.addText(body, { x: x + 0.35, y: 4.2, w: 3.2, h: 1.1, fontSize: 12.5, color: C.muted, fontFace: BODY, margin: 0 })
      x += 4.07
    }
    // milestones strip
    s.addShape(p.shapes.RECTANGLE, { x: M, y: 5.7, w: W - 2 * M, h: 1.0, fill: { color: C.felt } })
    s.addText(
      [
        { text: 'Milestones this funds:  ', options: { bold: true, color: C.gold } },
        { text: 'launch premium · reach [ — ] active users · [ — ]% free→paid conversion · prove monthly retention.', options: { color: C.cream } },
      ],
      { x: M + 0.3, y: 5.7, w: W - 2 * M - 0.6, h: 1.0, valign: 'middle', fontSize: 13.5, fontFace: BODY, margin: 0 },
    )
    footer(s, false)
  }

  // =========================================================== 12. CLOSING
  {
    const s = p.addSlide()
    s.background = { color: C.felt }
    s.addText('♠   ♥   ♦   ♣', { x: M, y: 0.7, w: 5, h: 0.5, fontSize: 18, color: C.feltHi, fontFace: BODY, margin: 0 })
    s.addText([{ text: '♠  ', options: { color: C.gold } }, { text: 'LeakTutor', options: { color: C.cream } }], {
      x: M, y: 2.4, w: 8, h: 0.6, fontSize: 24, bold: true, fontFace: HEAD, margin: 0,
    })
    s.addText('Stop studying poker.\nStart fixing your game.', {
      x: M, y: 3.1, w: 11.5, h: 1.8, fontSize: 46, bold: true, color: C.cream, fontFace: HEAD, lineSpacingMultiple: 1.0, margin: 0,
    })
    s.addShape(p.shapes.RECTANGLE, { x: M, y: 5.2, w: 3, h: 0.04, fill: { color: C.gold } })
    s.addText(
      [
        { text: 'daniel-willoughby.github.io/GTO-leak-fixer', options: { color: C.gold, bold: true, breakLine: true } },
        { text: '[ Founder name · email · phone ]', options: { color: C.creamMuted } },
      ],
      { x: M, y: 5.45, w: 9, h: 0.9, fontSize: 14, fontFace: BODY, paraSpaceAfter: 4, margin: 0 },
    )
    footer(s, true)
  }

  await p.writeFile({ fileName: 'LeakTutor-Investor-Deck.pptx' })
  console.log('WROTE LeakTutor-Investor-Deck.pptx')
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
