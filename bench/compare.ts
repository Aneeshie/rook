import { readFileSync } from 'node:fs';
import type { Result } from './harness';

type Run = { environment: Record<string, unknown>; results: Result[] };

const [beforePath, afterPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!beforePath || !afterPath) {
  console.error('usage: bun run bench:compare <before.json> <after.json> [--fail-on-regression]');
  process.exit(2);
}

const load = (path: string): Run => JSON.parse(readFileSync(path, 'utf8'));
const before = load(beforePath);
const after = load(afterPath);

for (const key of ['cpu', 'os', 'power', 'bun', 'xterm', 'rustc']) {
  if (before.environment[key] !== after.environment[key]) {
    console.log(`⚠ ${key} differs: ${before.environment[key]} → ${after.environment[key]}`);
  }
}

for (const [label, run] of [['before', before], ['after', after]] as const) {
  if (Number(run.environment.load) > Number(run.environment.cores) / 4) console.log(`⚠ ${label} ran with load average ${run.environment.load}`);
}

const NOISE_FLOOR = 0.05;
let regressions = 0;
const width = Math.max(...after.results.map((r) => r.name.length));

console.log(`\nbest of each, before → after\n${'benchmark'.padEnd(width)}  ${'before'.padStart(10)}  ${'after'.padStart(10)}  change`);
for (const result of after.results) {
  const old = before.results.find((r) => r.name === result.name);
  if (!old) {
    console.log(`${result.name.padEnd(width)}  ${'—'.padStart(10)}  ${result.best.toFixed(1).padStart(10)}  new`);
    continue;
  }

  const ratio = result.best / old.best;
  const better = result.higherIsBetter ? ratio - 1 : 1 / ratio - 1;
  const threshold = Math.max(NOISE_FLOOR, 1.5 * (old.spread + result.spread));
  const verdict = Math.abs(better) < threshold ? '~ noise' : better > 0 ? '▲ faster' : '▼ slower';
  if (verdict === '▼ slower') regressions++;

  console.log(
    `${result.name.padEnd(width)}  ${old.best.toFixed(1).padStart(10)}  ${result.best.toFixed(1).padStart(10)}  ${(better >= 0 ? '+' : '') + (better * 100).toFixed(1)}%  ${verdict}  (noise ±${(threshold * 100).toFixed(0)}%)  ${result.unit}`,
  );
}

if (regressions && process.argv.includes('--fail-on-regression')) process.exit(1);
