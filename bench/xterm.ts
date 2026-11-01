import { Terminal } from '@xterm/headless';
import { bench } from './harness';
import { COLS, FIXTURES, ROWS, encode } from './fixtures';
import type { FixtureName } from './fixtures';

const CHUNK = 64 * 1024;

const writeAll = (terminal: Terminal, data: Uint8Array) =>
  new Promise<void>((resolve) => {
    for (let offset = 0; offset < data.length; offset += CHUNK) {
      const chunk = data.subarray(offset, offset + CHUNK);
      if (offset + CHUNK >= data.length) terminal.write(chunk, resolve);
      else terminal.write(chunk);
    }
  });

export async function xtermBenchmarks() {
  const results = [];
  for (const name of Object.keys(FIXTURES) as FixtureName[]) {
    const data = encode(FIXTURES[name]());
    const terminal = new Terminal({ cols: COLS, rows: ROWS, scrollback: 1000, allowProposedApi: true });

    results.push(
      await bench(
        `xterm parse: ${name}`,
        async () => {
          terminal.reset();
          await writeAll(terminal, data);
        },
        { bytes: data.length, warmup: 2, minSamples: 8, minTimeMs: 2000 },
      ),
    );
    terminal.dispose();
  }
  return results;
}
