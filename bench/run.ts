import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { merge, printTable } from './harness';
import type { Result } from './harness';
import { layoutBenchmarks } from './layout';
import { xtermBenchmarks } from './xterm';

const ROOT = join(import.meta.dir, '..');
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const sh = (cmd: string[]) => {
  const out = Bun.spawnSync(cmd, { cwd: ROOT });
  return out.success ? out.stdout.toString().trim() : '';
};

const suites = (flag('--only') ?? 'layout,xterm,pty').split(',');
const rounds = Number(flag('--rounds') ?? 3);
const commit = sh(['git', 'rev-parse', '--short', 'HEAD']);
const dirty = sh(['git', 'status', '--porcelain', '--', 'src', 'src-tauri/src', 'bench']) !== '';
const name = flag('--save') ?? `${commit}${dirty ? '-dirty' : ''}`;

const environment = {
  date: new Date().toISOString(),
  commit,
  dirty,
  cpu: cpus()[0]?.model ?? 'unknown',
  cores: cpus().length,
  memoryGB: Math.round(totalmem() / 2 ** 30),
  os: `${sh(['sw_vers', '-productVersion']) || process.platform} (darwin ${release()})`,
  power: sh(['pmset', '-g', 'batt']).includes("'AC Power'") ? 'AC' : 'battery',
  bun: Bun.version,
  xterm: (await import('@xterm/headless/package.json')).version,
  rustc: sh(['rustc', '--version']),
  load: Number(loadavg()[0].toFixed(2)),
  rounds,
};

console.log(`${environment.cpu}, ${environment.os}, ${environment.power}, bun ${environment.bun}, commit ${commit}${dirty ? ' (uncommitted changes)' : ''}\n`);
if (environment.power === 'battery') console.log('⚠ on battery: results are less stable; plug in for numbers you want to keep');
if (environment.load > cpus().length / 4) console.log(`⚠ load average is ${environment.load}: close busy apps for numbers you want to keep`);

const runPty = (): Result[] => {
  const cargo = Bun.spawnSync(['cargo', 'bench', '-q', '--manifest-path', 'src-tauri/Cargo.toml', '--bench', 'pty'], {
    cwd: ROOT,
    stderr: 'inherit',
  });
  const line = cargo.stdout.toString().split('\n').find((l) => l.startsWith('BENCH_JSON '));
  if (!cargo.success || !line) {
    console.error('cargo bench failed');
    process.exit(1);
  }
  return JSON.parse(line.slice('BENCH_JSON '.length));
};

const raw: Result[] = [];
for (let round = 1; round <= rounds; round++) {
  console.log(`round ${round}/${rounds}`);
  if (suites.includes('layout')) raw.push(...(await layoutBenchmarks()));
  if (suites.includes('xterm')) raw.push(...(await xtermBenchmarks()));
  if (suites.includes('pty')) raw.push(...runPty());
}
const results = merge(raw);

console.log('');
printTable(results);

const dir = join(import.meta.dir, 'results');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${name}.json`);
writeFileSync(file, JSON.stringify({ environment, results }, null, 2) + '\n');
console.log(`\nsaved ${file.replace(ROOT + '/', '')}`);
