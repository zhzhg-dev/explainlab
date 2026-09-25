import { ARRIVAL_END, DURATION } from './model';
import type { Config, Frame, Result, Comparison } from './model';

// An independent stream for external arrivals keeps both strategies comparable.
function random(seed: number) {
  let a = seed | 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function stable(seed: number, id: number, attempt: number) {
  return random(
    (seed ^ Math.imul(id + 1, 2654435761) ^ Math.imul(attempt + 1, 1597334677)) >>> 0,
  )();
}
type Event = { at: number; order: number; run: () => void };
class Events {
  heap: Event[] = [];
  next = 0;
  add(at: number, run: () => void) {
    const e = { at, run, order: this.next++ };
    let i = this.heap.push(e) - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(e, this.heap[p])) break;
      this.heap[i] = this.heap[p];
      i = p;
    }
    this.heap[i] = e;
  }
  less(a: Event, b: Event) {
    return a.at < b.at || (a.at === b.at && a.order < b.order);
  }
  pop() {
    const first = this.heap[0],
      last = this.heap.pop()!;
    if (this.heap.length) {
      let i = 0;
      while (i * 2 + 1 < this.heap.length) {
        let j = i * 2 + 1;
        if (j + 1 < this.heap.length && this.less(this.heap[j + 1], this.heap[j])) j++;
        if (!this.less(this.heap[j], last)) break;
        this.heap[i] = this.heap[j];
        i = j;
      }
      this.heap[i] = last;
    }
    return first;
  }
}
export function workload(c: Config): number[] {
  const rng = random(c.seed);
  const arrivals: number[] = [];
  let t = 0;
  // Piecewise constant Poisson traffic. Restart at rate boundaries, so an
  // exponential interval never incorrectly crosses into a different rate.
  const segments =
    c.experiment === 'queue'
      ? [
          [0, 8000, 1],
          [8000, 14000, c.burst],
          [14000, ARRIVAL_END, 1],
        ]
      : [[0, ARRIVAL_END, 1]];
  for (const [start, end, factor] of segments) {
    t = start;
    for (;;) {
      t += (-Math.log(1 - rng()) * 1000) / (c.rate * factor);
      if (t >= end) break;
      arrivals.push(t);
    }
  }
  return arrivals;
}
type Request = {
  id: number;
  at: number;
  state: 'pending' | 'success' | 'failed' | 'rejected';
  n: number;
};
type Job = { r: Request; n: number; deadline: number; waiters?: Request[] };
export function simulate(c: Config, side: 'a' | 'b', arrivals = workload(c)): Result {
  const events = new Events();
  const requests: Request[] = [];
  const jobs: Job[] = [];
  const latencies: number[] = [];
  let active = 0,
    attempted = 0,
    success = 0,
    failed = 0,
    rejected = 0,
    timeouts = 0,
    peakQueue = 0,
    late = 0,
    hits = 0,
    sumLatency = 0;
  let cacheUntil = c.ttl * 1000,
    flight: Job | null = null;
  const frames: Frame[] = [];
  function settle(r: Request, t: number, state: Request['state']) {
    if (r.state !== 'pending') return;
    r.state = state;
    if (state === 'success') {
      success++;
      const latency = t - r.at;
      latencies.push(latency);
      sumLatency += latency;
    }
    if (state === 'failed') failed++;
    if (state === 'rejected') rejected++;
  }
  function pump(t: number) {
    while (active < c.concurrency && jobs.length) {
      const job = jobs.shift()!;
      active++;
      const slow = c.experiment === 'retry' && t >= 6000 && t < 14000 ? 5 : 1;
      // Work per original request is fixed independently of retry policy.
      const cost = c.service * (0.8 + 0.4 * stable(c.seed, job.r.id, 0)) * slow;
      events.add(t + cost, () => {
        active--;
        if (c.experiment === 'cache') {
          cacheUntil = t + cost + c.ttl * 1000;
          if (flight === job) flight = null;
          for (const r of job.waiters || [job.r]) {
            if (r.state === 'pending') settle(r, t + cost, 'success');
            else late++;
          }
        } else if (job.r.state === 'pending' && t + cost < job.deadline)
          settle(job.r, t + cost, 'success');
        else late++;
        pump(t + cost);
      });
    }
  }
  function enqueue(job: Job, t: number) {
    jobs.push(job);
    pump(t);
    peakQueue = Math.max(peakQueue, jobs.length);
  }
  function send(r: Request, t: number) {
    if (r.state !== 'pending') return;
    r.n++;
    attempted++;
    const n = r.n,
      deadline = t + c.timeout;
    enqueue({ r, n, deadline }, t);
    events.add(deadline, () => {
      if (r.state !== 'pending') return;
      timeouts++;
      const policy = side === 'a' ? 'fixed' : c.policy;
      if (n >= c.attempts || policy === 'none') {
        settle(r, deadline, 'failed');
        return;
      }
      const cap = Math.min(4000, 500 * 2 ** (n - 1));
      const delay =
        policy === 'fixed' ? 100 : policy === 'exponential' ? cap : stable(c.seed, r.id, n) * cap;
      events.add(deadline + delay, () => send(r, deadline + delay));
    });
  }
  for (let id = 0; id < arrivals.length; id++) {
    const t = arrivals[id];
    events.add(t, () => {
      const r: Request = { id, at: t, state: 'pending', n: 0 };
      requests.push(r);
      if (c.experiment === 'retry') {
        send(r, t);
        return;
      }
      if (c.experiment === 'cache') {
        if (t < cacheUntil) {
          hits++;
          settle(r, t, 'success');
          return;
        }
        events.add(t + c.timeout, () => {
          if (r.state === 'pending') {
            timeouts++;
            settle(r, t + c.timeout, 'failed');
          }
        });
        if (side === 'b' && flight) {
          flight.waiters!.push(r);
          return;
        }
        attempted++;
        const job: Job = { r, n: 1, deadline: t + c.timeout, waiters: [r] };
        if (side === 'b') flight = job;
        enqueue(job, t);
        return;
      }
      const limit = side === 'a' ? 240 : c.buffer;
      if (active >= c.concurrency && jobs.length >= limit) {
        settle(r, t, 'rejected');
        return;
      }
      attempted++;
      enqueue({ r, n: 1, deadline: t + c.timeout }, t);
      events.add(t + c.timeout, () => {
        if (r.state === 'pending') {
          timeouts++;
          settle(r, t + c.timeout, 'failed');
        }
      });
    });
  }
  function snapshot(time: number): Frame {
    const ordered = [...latencies].sort((a, b) => a - b);
    return {
      time,
      arrived: requests.length,
      success,
      failed,
      rejected,
      pending: requests.length - success - failed - rejected,
      attempts: attempted,
      timeouts,
      active,
      queued: jobs.length,
      peakQueue,
      hits,
      late,
      p95: ordered.length ? ordered[Math.ceil(ordered.length * 0.95) - 1] : 0,
      average: success ? sumLatency / success : 0,
    };
  }
  for (let t = 0; t <= DURATION; t += 200) {
    while (events.heap.length && events.heap[0].at <= t) events.pop().run();
    frames.push(snapshot(t));
  }
  return { frames, final: frames[frames.length - 1], arrivals, latencies };
}
export function compare(config: Config): Comparison {
  const arrivals = workload(config);
  return { config, a: simulate(config, 'a', arrivals), b: simulate(config, 'b', arrivals) };
}
