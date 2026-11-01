# Benchmarks

```bash
bun run bench
```

Runs every benchmark, prints a table and saves the results to `bench/results/<commit>.json` (`<commit>-dirty` with uncommitted changes in `src/`, `src-tauri/src/` or `bench/`). Results are per machine, so `bench/results/` is ignored by git. A full run takes about 1.5 minutes.

| Option | What it does |
|---|---|
| `--save <name>` | Save as `bench/results/<name>.json` instead |
| `--only xterm,pty` | Run some suites: `layout`, `xterm`, `pty` |
| `--rounds <n>` | How many times to run the whole suite (default 3) |

## What's measured

| Suite | Benchmark | What it tells you |
|---|---|---|
| `layout` | `compute 16 panes`, `split + close in 16 panes` | Cost of the pane tree in `src/layout/paneTree.ts` |
| `xterm` | `parse: plain`, `colored`, `unicode`, `redraw` | How fast xterm.js parses output, in `@xterm/headless` (no rendering) |
| `pty` | `cat 32 MB` | How fast output gets from a program through the PTY to the reader thread |
| `pty` | `keystroke echo` | Round trip of one key through the PTY to a raw-mode `cat` and back |

The xterm inputs are 4 MB each and generated from a fixed seed in `bench/fixtures.ts`, so every run parses the same bytes:

- **plain**: `seq` style numbered lines. It scrolls on every line, which makes it the slowest input.
- **colored**: log lines with 16-color and true-color escapes.
- **unicode**: CJK, emoji and accented text, which take the wide-character paths.
- **redraw**: full 200×50 screens drawn with cursor moves and synchronized output, like nvim.

The terminal is 200×50 and data is written in 64 KB chunks, the same as the app's output channel. The PTY benchmark starts zsh with an empty `ZDOTDIR`, so your own zsh config doesn't affect it. `@xterm/headless` is pinned to the same version as `@xterm/xterm`. Update both together.

None of these include the WebView: IPC, rendering and frame timing aren't measured. For that, use the end-to-end script below.

## Reading the numbers

| Column | Meaning |
|---|---|
| **best** | The fast end of the samples: the 90th percentile for throughput, the 10th for latency. This is the number to compare |
| **median** | The typical sample, for reference |
| **spread** | How much the fastest samples differ from each other. Small is stable |

Other apps, power saving and Apple silicon's efficiency cores can only make a sample slower, never faster, so the fast end stays stable when the median moves. Each run does 3 interleaved rounds and pools their samples, so a burst of load can't skew just one benchmark. The run records your CPU, macOS, power source, load average, Bun, xterm and Rust versions, and warns on battery or under load.

## Comparing

```bash
bun run bench --save before
```
Make your change, then:
```bash
bun run bench --save after
```
```bash
bun run bench:compare bench/results/before.json bench/results/after.json
```

Each benchmark is marked **▲ faster**, **▼ slower** or **~ noise**. A change counts only if it's bigger than both 5% and 1.5× the two runs' spreads combined. The noise threshold is printed on each line. Add `--fail-on-regression` to exit with an error if anything got slower.

The comparison warns when the two runs differ in CPU, OS, power, Bun, xterm or Rust version, or ran under load. For numbers you want to trust:

- **Plug in**, close busy apps (browsers, chat apps, anything rendering) and keep the load average low.
- **Compare runs from the same session.** Don't compare against a run from another day without rerunning the baseline.
- **Treat changes near the threshold as unproven** and rerun. Under heavy load (load average 7+), PTY throughput can swing about 30% between identical runs.

## End to end, against other terminals

`bench/terminal.sh` measures the whole app: PTY, IPC, parsing and rendering. Run it **inside** each terminal you want to compare (Rook, Ghostty, iTerm), with the window at the same size:

```bash
zsh bench/terminal.sh
```

It prints 2 million lines, then waits for the terminal to answer a cursor-position request. A terminal only answers after it has processed everything printed before the request, so the time covers the actual work, not just how long `cat` ran. It reports the median of 5 runs along with the terminal's name and size.
