import { describe, it, expect } from 'vitest';
import { compare, simulate, workload } from './engine';
import { defaults, parseUrl, shareUrl, validateConfig } from './model';
import type { Config, Experiment } from './model';
describe('deterministic event model', () => {
  it('reproduces results and shares the exact external workload', () => {
    const c = defaults.retry;
    const r = compare(c);
    expect(r).toEqual(compare(c));
    expect(r.a.arrivals).toEqual(r.b.arrivals);
    expect(workload({ ...c, policy: 'none', attempts: 1 })).toEqual(workload(c));
  });
  for (const scenario of ['retry', 'cache', 'queue'] as Experiment[])
    it(`${scenario}: conserves logical requests at every frame`, () => {
      for (const seed of [1, 42, 9812]) {
        const r = compare({ ...defaults[scenario], seed });
        for (const side of [r.a, r.b])
          for (const f of side.frames) {
            expect(f.success + f.failed + f.rejected + f.pending).toBe(f.arrived);
            expect(f.active).toBeLessThanOrEqual(r.config.concurrency);
            expect(f.queued).toBeGreaterThanOrEqual(0);
            expect(f.success).toBeLessThanOrEqual(f.arrived);
          }
      }
    });
  it('identical retry policies have identical output', () => {
    const r = compare({ ...defaults.retry, policy: 'fixed' });
    expect(r.a).toEqual(r.b);
  });
  it('does not retry a successful request', () => {
    const r = simulate({ ...defaults.retry, service: 50, timeout: 5000, rate: 5 }, 'b', [0, 1000]);
    expect(r.final.success).toBe(2);
    expect(r.final.attempts).toBe(2);
  });
  it('does not count a late response as success or cancel backend work', () => {
    const r = simulate({ ...defaults.retry, service: 1000, timeout: 200, attempts: 1 }, 'a', [0]);
    expect(r.final.failed).toBe(1);
    expect(r.final.success).toBe(0);
    expect(r.final.late).toBe(1);
    expect(r.frames[2].active).toBe(1);
  });
  it('never exceeds the attempt budget', () => {
    const r = compare({
      ...defaults.retry,
      rate: 150,
      concurrency: 1,
      service: 1000,
      timeout: 200,
      attempts: 6,
    });
    for (const s of [r.a, r.b]) {
      expect(s.final.attempts).toBeLessThanOrEqual(s.final.arrived * 6);
      expect(s.final.pending).toBe(0);
    }
  });
  it('coalesces simultaneous misses into exactly one origin fetch', () => {
    const c = { ...defaults.cache, ttl: 1 };
    const arr = [1001, 1002, 1003];
    const a = simulate(c, 'a', arr),
      b = simulate(c, 'b', arr);
    expect(a.final.attempts).toBe(3);
    expect(b.final.attempts).toBe(1);
    expect(b.final.success).toBe(3);
  });
  it('rejects immediately with a zero-slot waiting queue', () => {
    const c = { ...defaults.queue, concurrency: 1, buffer: 0 };
    const r = simulate(c, 'b', [0, 1, 2]);
    expect(r.final.success).toBe(1);
    expect(r.final.rejected).toBe(2);
    expect(r.final.peakQueue).toBe(0);
  });
  it('keeps unfinished requests pending at the observation boundary', () => {
    const c = {
      ...defaults.retry,
      timeout: 5000,
      attempts: 6,
      concurrency: 1,
      service: 1000,
      rate: 150,
      policy: 'exponential',
    } as Config;
    const r = simulate(c, 'b');
    expect(r.final.pending).toBeGreaterThan(0);
  });
  it('does not universally claim the alternative wins', () => {
    const r = compare({ ...defaults.retry, rate: 5, service: 50, concurrency: 24, timeout: 5000 });
    expect(r.a.final.success).toBe(r.b.final.success);
    expect(r.a.final.attempts).toBe(r.b.final.attempts);
  });
});
describe('shared scenario validation', () => {
  it('round-trips every experiment', () => {
    for (const c of Object.values(defaults)) {
      const url = shareUrl(c, 'zh', 'https://example.com/explainlab/?old=x#test');
      expect(parseUrl(url)).toEqual({ config: c, language: 'zh', invalid: false });
    }
  });
  it('rejects bad versions and out-of-bounds payloads', () => {
    expect(validateConfig({ ...defaults.retry, rate: Infinity })).toBeNull();
    expect(validateConfig({ ...defaults.retry, rate: 99999 })).toBeNull();
    expect(parseUrl('https://example.com/?v=99&s=%7B%7D').invalid).toBe(true);
    expect(parseUrl('https://example.com/?v=1&s=broken').config).toEqual(defaults.retry);
  });
});
