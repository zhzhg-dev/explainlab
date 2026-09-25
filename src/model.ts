export const VERSION = '1';
export const DURATION = 45000;
export const ARRIVAL_END = 24000;
export type Experiment = 'retry' | 'cache' | 'queue';
export type RetryPolicy = 'none' | 'fixed' | 'exponential' | 'jitter';
export interface Config {
  experiment: Experiment;
  seed: number;
  rate: number;
  service: number;
  concurrency: number;
  timeout: number;
  attempts: number;
  ttl: number;
  buffer: number;
  burst: number;
  policy: RetryPolicy;
}
export const defaults: Record<Experiment, Config> = {
  retry: {
    experiment: 'retry',
    seed: 42,
    rate: 20,
    service: 180,
    concurrency: 16,
    timeout: 1500,
    attempts: 4,
    ttl: 4,
    buffer: 12,
    burst: 4,
    policy: 'jitter',
  },
  cache: {
    experiment: 'cache',
    seed: 42,
    rate: 80,
    service: 600,
    concurrency: 4,
    timeout: 2500,
    attempts: 1,
    ttl: 4,
    buffer: 12,
    burst: 4,
    policy: 'jitter',
  },
  queue: {
    experiment: 'queue',
    seed: 42,
    rate: 24,
    service: 200,
    concurrency: 8,
    timeout: 2500,
    attempts: 1,
    ttl: 4,
    buffer: 12,
    burst: 4,
    policy: 'jitter',
  },
};
export const bounds: Record<
  Exclude<keyof Config, 'experiment' | 'policy'>,
  [number, number, number]
> = {
  seed: [1, 999999, 1],
  rate: [5, 150, 5],
  service: [50, 1000, 10],
  concurrency: [1, 24, 1],
  timeout: [200, 5000, 100],
  attempts: [1, 6, 1],
  ttl: [1, 10, 1],
  buffer: [0, 100, 1],
  burst: [2, 8, 1],
};
export function validateConfig(value: unknown): Config | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!['retry', 'cache', 'queue'].includes(String(v.experiment))) return null;
  if (!['none', 'fixed', 'exponential', 'jitter'].includes(String(v.policy))) return null;
  for (const [key, [min, max]] of Object.entries(bounds))
    if (
      typeof v[key] !== 'number' ||
      !Number.isInteger(v[key]) ||
      (v[key] as number) < min ||
      (v[key] as number) > max
    )
      return null;
  return Object.fromEntries(
    [...Object.keys(bounds), 'experiment', 'policy'].map((k) => [k, v[k]]),
  ) as unknown as Config;
}
export function shareUrl(config: Config, language: string, base: string): string {
  const url = new URL(base);
  url.hash = '';
  url.search = '';
  url.searchParams.set('v', VERSION);
  url.searchParams.set('lang', language);
  url.searchParams.set('s', JSON.stringify(config));
  return url.href;
}
export function parseUrl(href: string): {
  config: Config;
  language: 'en' | 'zh';
  invalid: boolean;
} {
  const p = new URL(href).searchParams;
  let config: Config | null = null;
  try {
    if (p.get('v') === VERSION) config = validateConfig(JSON.parse(p.get('s') || 'null'));
  } catch {
    /* Invalid links use a safe preset. */
  }
  return {
    config: config || { ...defaults.retry },
    language: p.get('lang') === 'zh' ? 'zh' : 'en',
    invalid: p.has('s') && !config,
  };
}
export interface Frame {
  time: number;
  arrived: number;
  success: number;
  failed: number;
  rejected: number;
  pending: number;
  attempts: number;
  timeouts: number;
  active: number;
  queued: number;
  peakQueue: number;
  hits: number;
  p95: number;
  average: number;
  late: number;
}
export interface Result {
  frames: Frame[];
  final: Frame;
  arrivals: number[];
  latencies: number[];
}
export interface Comparison {
  config: Config;
  a: Result;
  b: Result;
}
