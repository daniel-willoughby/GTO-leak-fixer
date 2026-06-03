#!/usr/bin/env bash
# Solve a batch of BTN-vs-BB single-raised-pot flops with TexasSolver.
# Reuses the app's preflop ranges. Dumps <board>_result.json into the install dir.
set -e
PROJ="/Users/danwilloughby/Documents/Code Projects/gto-leak-tutor"
INSTALL="/Users/danwilloughby/Documents/Code Projects/TexasSolver/install"

IP=$(node "$PROJ/solver-spike/build-ranges.mjs" | sed -n 's/^IP_RANGE=//p')
OOP=$(node "$PROJ/solver-spike/build-ranges.mjs" | sed -n 's/^OOP_RANGE=//p')

BOARDS=(As8c3h KsTh5d 9h8h4c Jd7d2s 6s5h4d)

cd "$INSTALL"
for B in "${BOARDS[@]}"; do
  CB="${B:0:2},${B:2:2},${B:4:2}"   # comma-separated board
  IN="board_${B}.txt"
  OUT="board_${B}_result.json"
  [ -f "$OUT" ] && { echo "skip $B (exists)"; continue; }
  cat > "$IN" <<EOF
set_pot 5.5
set_effective_stack 97.5
set_board $CB
set_range_ip $IP
set_range_oop $OOP
set_bet_sizes oop,flop,bet,33
set_bet_sizes oop,flop,raise,75
set_bet_sizes oop,flop,allin
set_bet_sizes ip,flop,bet,33
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
dump_result $OUT
EOF
  echo "=== solving $B ==="
  ./console_solver -i "$IN" > "board_${B}.log" 2>&1
  echo "=== done $B ($(grep -c Iter "board_${B}.log") iters) ==="
done
echo "ALL BOARDS DONE"
