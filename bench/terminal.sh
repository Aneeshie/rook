#!/bin/zsh
# usage: zsh bench/terminal.sh [runs]
# run it inside any terminal (Rook, Ghostty, iTerm) at the same window size to compare them end to end:
# it times printing 2M lines until the terminal has processed all of them, not just until cat exits
zmodload zsh/datetime
file=${TMPDIR:-/tmp}/rook-bench-terminal.txt
runs=${1:-5}
[[ -f $file ]] || seq 1 2000000 > $file

times=()
for i in {1..$runs}; do
  start=$EPOCHREALTIME
  cat $file
  printf '\e[6n'; read -s -t 30 -d R
  times+=$(( EPOCHREALTIME - start ))
done

clear
sorted=(${(on)times})
for t in $times; do printf 'run: %.3fs\n' $t; done
printf '\n%s %sx%s  median: %.3fs  (%d runs)\n' "${TERM_PROGRAM:-unknown}" $COLUMNS $LINES ${sorted[$(( (runs + 1) / 2 ))]} $runs
