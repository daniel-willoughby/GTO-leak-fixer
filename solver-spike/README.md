# Postflop solver-data spike

**Goal of this spike:** de-risk the single assumption that can kill LeakTutor —
*can we produce a correct, credible postflop strategy corpus cheaply enough,
in a format the app can query offline?* Preflop ships without a solver; postflop
cannot. This folder proves the **data contract and query path** end-to-end with
placeholder data, and documents the pipeline to fill it with real solves.

## What's here

| File | Purpose |
|------|---------|
| `schema.ts` | The `FlopNode` data contract between solver and app. The moat-defining interface — keep it stable. |
| `sample-flop.json` | One fully-shaped node: BTN-vs-BB single-raised pot, flop `Qs7h2c`, BTN c-bet decision. Hand-tuned placeholder freqs. |
| `query.mjs` | Demonstrates the app consuming a node: per-hand strategy + range-wide aggregate. |

```bash
node solver-spike/query.mjs AQs   # top pair → bets ~92%
node solver-spike/query.mjs 65s   # air → mostly checks
```

## Scope decision (deliberately narrow)

The MVP corpus targets **one preflop context at a time**, not "every spot":

- Format: 6-max, 100bb, single-raised pots
- Node: flop only, **single bet size** (33% pot) — matches GTO Wizard's
  "Single Size" simplification, which cuts the tree ~ an order of magnitude
- First context: `BTN_vs_BB_SRP` (the most common postflop spot in 6-max)
- Board coverage: a clustered/strategically-representative subset of the 1755
  isomorphic flops (≈ 25–60 boards), not all of them

This keeps the first solve batch in **hours, not weeks**, and keeps the shipped
dataset small enough to precache in the PWA.

## Real pipeline (to replace the placeholder)

1. **Solve** with [TexasSolver](https://github.com/bupticybee/TexasSolver) (free,
   open-source, CLI-scriptable) or PioSolver if licensed.
   - Input ranges: reuse our preflop ranges (`src/data/`) for BTN-open and
     BB-call to seed the flop node.
   - Target exploitability ≤ 0.3% pot, single 33% size, rake-free.
2. **Export** each solve's flop strategy (TexasSolver dumps JSON/CSV per node).
3. **Transform** into `FlopNode` shape (`scripts/transform.ts`, TODO) — key by
   exact combo for blocker accuracy, attach `meta`.
4. **Validate**: spot-check 10–15 hands per board against GTO Wizard's free
   tier; flag any node whose primary action disagrees. Gate the dataset on this.
5. **Ship**: bundle as static JSON/SQLite, served via the existing service-worker
   precache. App queries with `query.mjs`'s logic.

## Cost / risk estimate

- **Compute:** a 33%-only SRP flop solves in ~seconds–low minutes on a modern
  multi-core CPU. ~40 boards × one context ≈ a single overnight batch on a
  desktop, or a few dollars of spot cloud CPU. **Tractable.**
- **Storage:** one node ≈ a few KB; ~40 boards ≈ well under 1 MB precached.
- **Main risk:** *correctness/validation*, not compute. The work is building the
  transform + validation harness and trusting the output — not raw solving.
- **Turn / river** multiply the tree hard; defer until the flop loop proves out.

## Status

🟡 **Spike scaffolded.** Contract + query path proven with placeholder data.
Not yet wired into the app and **not real solver output**. Next concrete step:
install TexasSolver, script one `BTN_vs_BB_SRP` flop solve, and replace
`sample-flop.json` with transformed real output to validate the format against
genuine solver data.
