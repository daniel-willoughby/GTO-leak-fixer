# All-seats Freeplay — solve plan

Goal: make Freeplay feel like a real game — you're dropped into different seats and
face a **variety of real decisions** (c-bet, face a c-bet, face a check-raise, donk,
barrel) with **≥2 bet sizes on every street**, all solver-true.

## What we'll solve

Four single-raised-pot matchups, each **opener vs a BB flat-call**:

| Matchup | You can play as… |
|---|---|
| `UTG_vs_BB` | the UTG opener (IP) **or** the BB defender (OOP) |
| `HJ_vs_BB` | HJ opener / BB defender |
| `CO_vs_BB` | CO opener / BB defender |
| `BTN_vs_BB` | BTN opener / BB defender |

That covers every opener seat **and** the out-of-position defender role — so "random
seat" and "react to bets" both come from real data (no more fish heuristic needed for
the GTO opponent). Ranges are generated and verified by `build-ranges-all.mjs`.

> Other contexts (blind-vs-blind, 3-bet pots, IP cold-calls) are a later batch — each
> needs its own ranges + solve. This set is the high-value core.

## Why ≥2 sizes everywhere is now possible

The current corpus has 2 sizes on the **flop only** because the original config used a
single turn/river size. The new config sets **two sizes on flop, turn, and river**
(`set_bet_sizes …,turn,bet,33,75`, same for river) for both players. The full game
tree the solver already computes contains every line — we just have to **extract more
node types** than the single IP-c-bet node we pulled last time.

## The plan (de-risked — don't burn 24h on a guess)

1. **I write** `solve-allseats.mjs` (matchup × board loop, 2 sizes every street,
   thread-throttled, resumable) and a richer `transform-allseats.mjs` that extracts:
   IP c-bet, IP facing a check-raise, **OOP donk, OOP facing a c-bet (fold/call/raise)**,
   plus turn/river barrels and raises.
2. **You run ONE test board, one matchup** (~20–40 min at medium power) and send me the
   dump. I build/verify the transform against the *real* output and confirm the node
   schema before you commit a full night.
3. **You run the full batch** (resumable across nights). Medium power below.
4. **I wire all-seats Freeplay** to the new multi-matchup / multi-node data: random
   matchup → random seat → walk the tree facing real, varied decisions.

## Medium power (quiet Mac, long run)

In the solver input, drop threads from 8 → 4 and keep accuracy:

```
set_thread_num 4        # ~half the cores → cooler, quieter, ~2× wall-clock
set_accuracy 0.5        # keep quality
set_max_iteration 90
```

`solve-allseats.mjs` will expose this as `--threads 4` (default) so you can dial it.

## Rough time budget (medium power, 4 threads)

- ~10–20 min per board per matchup (2 sizes/street ≈ a bit slower than before).
- ~30 boards × 4 matchups ≈ **120 solves ≈ 25–40 hours** of compute.
- It's **resumable** (per-matchup accum) — run it across several nights; a 24h block
  gets you ~2–3 matchups, the rest on following nights.
- River turn-rooted re-solves add time but are disk-safe (one dump at a time).

## Disk

Same self-cleaning approach as before (solve → extract → delete each ~150 MB dump).
Keep the turn-rooted river dumps on the external drive via `LEAKTUTOR_TURN_DUMPS`.
Peak local use stays small.

---

**Next step is mine:** build `solve-allseats.mjs` + `transform-allseats.mjs`, then give
you the single test-board command. Say go and I'll write them.
