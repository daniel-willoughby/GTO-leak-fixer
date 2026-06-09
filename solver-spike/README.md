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
| `sample-flop.json` | **Real TexasSolver output**: BTN-vs-BB single-raised pot, flop `Qs7h2c`, BTN c-bet-facing-check node. 92 hands, ~4% pot exploitability. |
| `build-ranges.mjs` | Expands our app preflop ranges into TexasSolver range strings (IP = BTN open, OOP = BB flat-call). |
| `transform.mjs` | Parses a TexasSolver dump, extracts the BTN c-bet node, aggregates per-combo strategy to 169-hand labels, writes `sample-flop.json`. |
| `query.mjs` | Demonstrates the app consuming a node: per-hand strategy + range-wide aggregate. |

```bash
node solver-spike/query.mjs AKs   # nut overcards/backdoors → bets 100%
node solver-spike/query.mjs A9o   # thin showdown value → checks 66%
node solver-spike/query.mjs 22    # bottom set → bets 98%
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

## Reproduce (this is how `sample-flop.json` was generated)

Solver: [TexasSolver](https://github.com/bupticybee/TexasSolver) console build,
free + open source. macOS arm64 build notes (the bundled deps are old):

```bash
brew install cmake llvm libomp
git clone --depth 1 -b console https://github.com/bupticybee/TexasSolver
# CMakeLists.txt tweaks needed for a modern toolchain:
#   - set(CMAKE_CXX_STANDARD 20)            # fmt 6.x needs real char8_t
#   - comment out the ext/pybind11 add_subdirectory (unused, breaks on py3.12+)
cd TexasSolver && mkdir build && cd build
CC=$(brew --prefix llvm)/bin/clang CXX=$(brew --prefix llvm)/bin/clang++ \
  cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH=$(brew --prefix llvm) \
           -DCMAKE_POLICY_VERSION_MINIMUM=3.5
make console_solver -j8
# assemble a run dir (skip `make install` — it also builds the broken test target)
cd .. && mkdir -p install && cp build/console_solver install/ && cp -R resources install/
```

Then, from the app repo:

```bash
node solver-spike/build-ranges.mjs          # → IP/OOP range strings
#   build an input file (see git history for the exact one): pot 5.5, eff 97.5,
#   board Qs,7h,2c, single 33% bet size, allin threshold 0.67
cd ../TexasSolver/install && ./console_solver -i btn_vs_bb_Qs7h2c.txt   # ~9 min
node solver-spike/transform.mjs <result.json>   # → solver-spike/sample-flop.json
```

The 74 MB raw dump stays out of the repo; `transform.mjs` extracts just the
BTN c-bet node (root = OOP check/bet → `CHECK` child = IP facing a check).

## Cost / risk estimate (confirmed by this run)

- **Compute:** this single SRP flop (97.5bb deep, full turn/river, one bet size +
  one raise + all-in) reached ~4% pot exploitability in ~9 min on 8 threads.
  Narrowing the tree further (cap the raise/all-in lines) would cut that hard.
  ~40 boards × one context ≈ a single overnight desktop batch. **Tractable.**
- **Storage:** this node is ~12 KB of JSON; ~40 boards ≈ well under 1 MB precached.
- **Main risk:** *validation*, not compute — next is spot-checking primaries
  against GTO Wizard's free tier and gating the dataset on agreement.
- **Turn / river decisions** multiply the tree; defer until the flop loop proves out.

## Expanding the corpus: ~30 boards + bet-sizing (the v2 batch)

The app is already wired for a **bet-sizing decision** (Check / Bet ⅓ / Bet ¾) and
a ~30-board, texture-balanced set — the data layer is backward compatible, so the
new sizes light up automatically once a 3-action `street-nodes.json` is dropped in.
Producing that data is the only remaining step, and it must run on a **real machine**
(see the environment note below).

Pipeline (all three scripts are committed and validated against an existing dump):

```bash
# 1. Solve. Writes to a STAGING file — never clobbers live src/data.
#    Resumable (.accum-flopturn.json); disk-safe (solves → extracts → deletes each
#    150 MB dump before the next board). ~30 boards ≈ one overnight batch on 8 cores.
node solver-spike/solve-boards.mjs            # → solver-spike/.street-nodes.staging.json

# 2. Heuristic spot-check before trusting the batch: dry/high-card flops c-bet at
#    high frequency and lean SMALL (⅓); the big (¾) size stays a minority; AA bets
#    high; every node's frequencies sum to ~1.
node solver-spike/validate.mjs

# 3. Promote staging → src/data/street-nodes.json, then re-add river continuation
#    from the turn-rooted dumps (transform-rivers.mjs).
node solver-spike/finalize.mjs
```

Key facts baked into the scripts:

- **Two flop bet sizes** are configured (`set_bet_sizes ip,flop,bet,33` **and** `…,75`).
  The aggregator emits size-tagged actions `check / bet33 / bet75`. The solver's
  **all-in** line (amount ≥ 25bb) is *excluded* and its tiny frequency folded into the
  largest sizing bucket, so the app never shows a jam mislabelled as "¾".
- `set_dump_rounds 2` → **flop + turn** come from the same batch (turn nodes naturally
  emit `check / bet33`). **River** needs the separate turn-rooted re-solves; new boards
  get flop+turn only and the app's `hasRiver()` gate hides the river-continue button
  where data is absent. River continuation stays on the original boards.
- Validate against the same heuristics (and optionally GTO Wizard's free tier) before
  the full run, exactly as for the original spike.

### ⚠️ Run the solver on your own machine

`console_solver` **cannot run inside the Claude Code agent environment** — every
invocation wedges in an uninterruptible (`UE`) state at 0% CPU with no output and
can't be killed until reboot. All app wiring, tests, and the pipeline scripts above
are finished and committed; the only thing left is to execute the three commands on
your real desktop. After `finalize.mjs`, run `npm test` and `npm run build` to confirm
the new 3-action nodes pass the data-integrity test, then commit `src/data/street-nodes.json`.

## Status

🟢 **Spike proven with real solver data.** Toolchain builds, one
`BTN_vs_BB_SRP` flop is solved, and the output flows through `transform.mjs` →
`FlopNode` → `query.mjs`. The strategies are sound (sets / top pair c-bet ~99%,
thin showdown hands like A9o check ~66%). Not yet wired into the drill UI.

Next: (1) validate primaries vs GTO Wizard, (2) batch ~40 representative boards,
(3) add a `Postflop` drill mode that loads these nodes.
