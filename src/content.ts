import type { Experiment, RetryPolicy } from './model';
export type Language = 'en' | 'zh';
export const titles: Record<Experiment, [string, string]> = {
  retry: ['Retry storm', '重试风暴'],
  cache: ['Cache stampede', '缓存击穿'],
  queue: ['Queue overload', '队列拥堵'],
};
export const subtitles: Record<Experiment, [string, string]> = {
  retry: ['When trying again makes everything worse.', '为什么再试一次，会让整个系统更糟？'],
  cache: [
    'One expired key. A thousand trips to the origin.',
    '一个热点键过期，为什么后端突然被压垮？',
  ],
  queue: ['A longer queue is not always a better queue.', '队列更长，不代表系统更可靠。'],
};
export const strategyA: Record<Experiment, [string, string]> = {
  retry: ['Fixed retries', '固定间隔重试'],
  cache: ['Independent fetches', '各自回源'],
  queue: ['Large queue', '大队列'],
};
export const strategyB: Record<Experiment, [string, string]> = {
  retry: ['Backoff + jitter', '退避 + 随机抖动'],
  cache: ['Single-flight', '请求合并'],
  queue: ['Bounded queue', '有界队列'],
};
export const policyNames: Record<RetryPolicy, [string, string]> = {
  none: ['No retries', '不重试'],
  fixed: ['Fixed retries', '固定间隔重试'],
  exponential: ['Exponential backoff', '指数退避'],
  jitter: ['Backoff + jitter', '退避 + 随机抖动'],
};
export const lessons: Record<Experiment, [string, string][]> = {
  retry: [
    ['The failure', '故障'],
    [
      'Between 6–14 seconds, work takes 5× longer. Clients time out, but their original work stays on the server. Retries add more work to the same queue.',
      '在第 6–14 秒，服务耗时变为 5 倍。客户端超时后，原任务仍留在服务端；重试把更多任务塞进同一个队列。',
    ],
    ['The trade-off', '权衡'],
    [
      'Backoff spreads attempts over time; jitter desynchronizes them. It can reduce pressure, but it also delays retries. It is not a substitute for capacity or a retry budget. Try “No retries” as a counterexample.',
      '指数退避拉开重试间隔，随机抖动降低同步重试的概率。它能减轻压力，也会推迟恢复；它不能代替容量规划或重试预算。试试「不重试」这个对照组。',
    ],
  ],
  cache: [
    ['The failure', '故障'],
    [
      'A hot key starts warm. At each TTL expiry, every miss can start its own origin fetch. These duplicate fetches compete for a limited number of workers.',
      '热点键初始已缓存。每次 TTL 到期后，每个未命中请求都可能独立回源；重复回源任务争抢有限的工作线程。',
    ],
    ['The trade-off', '权衡'],
    [
      'Single-flight shares one in-progress fetch among waiting readers. It removes duplicate work for this one key, but all those readers depend on the same fetch. Multi-key traffic and distributed locks are outside this model.',
      '请求合并让等待者共享同一个回源任务，减少单个键的重复工作，但所有等待者也依赖这一个任务。本模型不模拟多键流量和分布式锁。',
    ],
  ],
  queue: [
    ['The failure', '故障'],
    [
      'Traffic jumps during seconds 8–14. A 240-slot queue accepts work even when the wait exceeds the client deadline. Timed-out work still uses capacity.',
      '第 8–14 秒流量骤增。240 个等待槽位会继续接收请求，即使等待时间已经超过客户端的截止时间；超时任务仍消耗处理能力。',
    ],
    ['The trade-off', '权衡'],
    [
      'A bounded queue rejects excess arrivals immediately. Successful requests may finish sooner, but rejected requests still count as unsuccessful. Compare total success and rejection, not just latency.',
      '有界队列立即拒绝超出的请求。成功请求可能更快完成，但被拒绝的请求仍计入未成功。请同时比较总成功率和拒绝数，不能只看延迟。',
    ],
  ],
};
export const sources: Record<Experiment, { label: string; href: string }[]> = {
  retry: [
    {
      label: 'AWS · Exponential backoff and jitter',
      href: 'https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/',
    },
  ],
  cache: [
    {
      label: 'Cloudflare · Cache stampedes',
      href: 'https://blog.cloudflare.com/sometimes-i-cache/',
    },
  ],
  queue: [
    {
      label: 'Google SRE · Handling overload',
      href: 'https://sre.google/sre-book/handling-overload/',
    },
  ],
};
