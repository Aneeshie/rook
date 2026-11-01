export type Result = {
  name: string;
  unit: 'MB/s' | 'ops/s' | 'µs';
  higherIsBetter: boolean;
  best: number;
  median: number;
  spread: number;
  samples: number;
  values: number[];
};

type Options = {
  bytes?: number;
  operations?: number;
  warmup?: number;
  minSamples?: number;
  minTimeMs?: number;
};

export const quantile = (values: number[], q: number) => {
  const s = [...values].sort((a, b) => a - b);
  const at = (s.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return s[lo] + (s[hi] - s[lo]) * (at - lo);
};

// interference only ever slows a sample down, so the fast end is the stable estimate
export const summarize = (
  name: string,
  unit: Result['unit'],
  higherIsBetter: boolean,
  values: number[],
): Result => {
  const fast = higherIsBetter ? 0.9 : 0.1;
  const nearFast = higherIsBetter ? 0.75 : 0.25;
  const best = quantile(values, fast);
  return {
    name,
    unit,
    higherIsBetter,
    best,
    median: quantile(values, 0.5),
    spread: Math.abs(best - quantile(values, nearFast)) / best,
    samples: values.length,
    values,
  };
};

export const merge = (results: Result[]): Result[] => {
  const byName = new Map<string, Result[]>();
  for (const r of results) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  return [...byName.values()].map((group) =>
    summarize(group[0].name, group[0].unit, group[0].higherIsBetter, group.flatMap((r) => r.values)),
  );
};

export async function bench(name: string, fn: () => unknown, options: Options = {}): Promise<Result> {
  const { bytes, operations = 1, warmup = 3, minSamples = 10, minTimeMs = 1000 } = options;

  for (let i = 0; i < warmup; i++) await fn();

  const times: number[] = [];
  const start = performance.now();
  while (times.length < minSamples || performance.now() - start < minTimeMs) {
    Bun.gc(true);
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }

  return bytes
    ? summarize(name, 'MB/s', true, times.map((ms) => bytes / 1e6 / (ms / 1000)))
    : summarize(name, 'ops/s', true, times.map((ms) => (operations * 1000) / ms));
}

const format = (value: number) =>
  value >= 1000 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);

export const printTable = (results: Result[]) => {
  const width = Math.max(...results.map((r) => r.name.length));
  console.log(`${'benchmark'.padEnd(width)}  ${'best'.padStart(9)}        ${'median'.padStart(9)}  spread  samples`);
  for (const r of results) {
    console.log(
      `${r.name.padEnd(width)}  ${format(r.best).padStart(9)} ${r.unit.padEnd(5)}  ${format(r.median).padStart(9)}  ±${(r.spread * 100).toFixed(1).padStart(4)}%  ${r.samples}`,
    );
  }
};
