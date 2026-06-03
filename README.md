# LeakTutor — GTO Poker

An offline-first PWA that finds your poker leaks and fixes them with GTO-based
drills. Built beginner-first: every decision comes with a plain-English *why*,
not just a frequency.

## Why this exists

The GTO training market is crowded with solver-library tools aimed at grinders
(GTO Wizard et al., $39+/mo). LeakTutor doesn't compete on library breadth — it
wins on the layers those tools are slow to build: **personalised leak-finding,
explanations, beginner onboarding, and price** (free core). Offline PWA = no app
store cut, installable, works on a plane.

## Features

- **Drill** — 6-max 100bb spots on a visual poker table.
  - *Open (RFI)*: folded to you, raise or fold.
  - *Facing a raise*: fold / call / 3-bet vs a curated set of matchups.
  - Each answer is scored against GTO ranges with a tailored explanation + the
    full 13×13 range grid, your hand highlighted.
- **Leaks** — every decision is logged locally (IndexedDB) and aggregated into
  accuracy, per-position / per-hand-type error rates, and your top 3 leaks.
- **Learn** — concept lessons + an interactive opening-range explorer.

## Stack

Vite · React · TypeScript · Tailwind · Dexie (IndexedDB) · vite-plugin-pwa

## Develop

```bash
npm install
npm run dev      # dev server
npm run build    # production build + service worker
npm run icons    # regenerate PWA icons from the logo SVG
```

## Data accuracy

Preflop ranges (`src/data/`) are **solver-approximate** published ranges — good
enough for a beginner tutor, flagged as such in code. The exact-solver corpus
(including postflop) is a separate track; see [`solver-spike/`](solver-spike/)
for the data contract, a sample node, and the pipeline plan.

## Status

Preflop MVP complete (RFI + vs-RFI). Postflop solver pipeline scaffolded, not yet
wired in. Roadmap: real postflop solves, hand-history import.
