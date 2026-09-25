# Simulation model v1

ExplainLab is an educational discrete-event simulator. It does not contact an actual backend. The numbers are consequences of the assumptions below, not measured cloud-provider performance.

## Time, randomness, and comparison

- Internal time uses floating-point milliseconds. A stable min-heap processes events by time, then insertion order. Events at exactly the same time use FIFO insertion order; an attempt response at its deadline is too late.
- External arrivals are a seeded Poisson process. The seed is a 32-bit integer accepted in the UI range 1–999999. Traffic runs for 24 seconds. Queue-overload traffic changes rate at 8 and 14 seconds; a new exponential interval is sampled at each boundary.
- The exact arrival array is shared by A and B. Service cost is `base × (0.8 + 0.4 × stableRandom(seed, requestId))`. It is independent of retry policy and retry random draws. Retries of one logical request have the same base cost.
- FIFO workers execute at most the configured concurrency. Service duration is fixed at the instant work starts. No preemption or cancellation is modeled. A job that starts just before recovery keeps its previously assigned slow duration.
- Observation ends at 45 seconds, with snapshots every 200ms. Late backend work or pending clients may remain. We do not silently drain all work past 45 seconds or convert pending requests to failures.
- Playback speed changes only the presentation, never simulation time or results. Scenario sharing reproduces the configuration, not the current playback position.

## Logical requests versus backend work

Every external arrival creates one logical request. Its state moves from pending to exactly one terminal outcome: success, failure, or rejection.

At every snapshot:

```text
arrived = succeeded + failed + rejected + pending
active backend jobs <= configured workers
```

An original request can have multiple backend attempts but can succeed at most once. Expired work continues consuming workers and queue space. The model deliberately exposes the cost of not propagating cancellation.

## Retry storm

Between 6s (inclusive) and 14s (exclusive), jobs that start service receive a 5× service-time multiplier. The backend queue is unbounded in this experiment.

- Each attempt has a fresh client deadline of `send time + timeout`, including queue wait.
- A response succeeds only if that attempt's deadline has not elapsed and the logical request is still pending.
- On timeout, the client retries if its total attempt budget is not exhausted. Maximum attempts includes the initial request. A timed-out attempt's later response is ignored even if the logical request has not yet failed.
- A new attempt is not sent if the logical request is already terminal. Backend work already sent is never canceled.
- Fixed retries wait 100ms. Exponential retry number `n` after an attempt timeout waits `min(4000ms, 500ms × 2^(n−1))`. Full jitter chooses uniformly between 0 and that bound using a separate deterministic draw. “No retries” sends exactly one attempt.
- This represents safe, idempotent reads. It does not represent retrying non-idempotent writes, retry-after headers, retry budgets across services, circuit breakers, or network failures.

The preset (20 arrivals/s, 180ms base work, 16 workers, 1500ms timeout, 4 total attempts, seed 42) is selected near a recoverable boundary. Increasing load can remove any advantage from backoff. It is not a universal recommendation for those values.

## Cache stampede

There is one hot cache key. It begins warm and expires after the selected TTL. Hits finish immediately with zero modeled latency; their inclusion can make p95 latency zero. All non-hit readers get a deadline relative to their own arrival.

- **A: independent fetches.** Every miss starts its own origin job. Every completed origin job refreshes the same key for another TTL, even if its requesting client has timed out.
- **B: single-flight.** Only one origin job may be in flight. Readers arriving during that fetch become waiters. Completion refreshes the cache and answers every still-pending waiter. Each waiter has its own deadline; an expired waiter is not resurrected.
- Timed-out origin work is not canceled. A later origin completion can warm the cache. The shared fetch uses the triggering reader's service cost; coalesced followers do not consume their own service work.
- This is single-process coalescing, not a distributed lock. No multi-key distribution, stale-while-revalidate, failures at the origin, eviction, lock expiry, or out-of-order value semantics are modeled. Independent duplicate refreshes may extend the cache's warm period; that behavior is intentional.

## Queue overload

Arrival rate multiplies by the chosen burst factor during 8–14s. There are no retries.

- A can hold **240 waiting jobs**, in addition to active workers.
- B can hold the configured number of waiting jobs, including zero.
- When all workers and waiting slots are full, a new logical request is rejected immediately and creates no backend job.
- Accepted clients time out if they have not received a result by their deadline. Their backend jobs remain in the queue and still execute.
- Rejection is an unsuccessful outcome, not an artificially fast success. No caller retry or upstream queue is modeled.

## Measurements

| Metric                 | Definition                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Success %              | Successful logical requests / logical arrivals observed so far                                                   |
| Failed                 | Logical requests whose client deadline/attempt budget expired                                                    |
| Rejected               | Logical requests rejected immediately due to a full waiting queue                                                |
| Pending                | Logical requests with no terminal result yet                                                                     |
| Request amplification  | Total backend attempts sent / original arrivals so far                                                           |
| Origin fetches         | Origin jobs created on cache misses (not cache reads or waiting readers)                                         |
| p95                    | Nearest-rank 95th percentile of successful logical-request latency, including retry delays; zero if no successes |
| Peak queue             | Maximum number of backend jobs waiting; active workers excluded                                                  |
| Timeout count (engine) | Attempt timeouts for retries; client timeouts for other experiments                                              |
| Late count (engine)    | Ignored backend responses; cache coalescing counts expired waiter responses individually                         |

Always read successful-request latency alongside failure, rejection, and pending counts. A policy can look faster merely because its slow requests never succeed. Graph scales are shared across both strategies and the entire observation window.

## URL contract and privacy

`?v=1&lang=en&s=<URL-encoded JSON config>` carries bounded numeric parameters and allowlisted experiment/policy names. Invalid data, unsupported versions, non-integers, or out-of-range values fall back to the default preset with a notice. Do not place personal data or secrets in scenario URLs; they are intended for public sharing.

The app has no accounts, model API calls, tracking scripts, external fonts, or application backend. GitHub Pages handles normal static-site requests and may retain its own service logs. GitHub README badges are external images; they are not loaded by the app.

## References

- [AWS: Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Cloudflare: Sometimes I cache](https://blog.cloudflare.com/sometimes-i-cache/)
- [Google SRE: Handling Overload](https://sre.google/sre-book/handling-overload/)

These sources motivate concepts. The implementation, simplifying assumptions, and numeric presets are ExplainLab's own.

## 中文摘要

模型模拟前 24 秒产生的请求，观察到第 45 秒。两组使用相同随机种子、相同外部到达序列；工作按 FIFO 执行。客户端超时**不会**取消服务端任务。

每个逻辑请求最多成功一次，始终满足「到达数 = 成功 + 失败 + 拒绝 + 待完成」。重试实验中，每次尝试有独立截止时间；该次尝试超时后，其迟到响应被忽略。缓存实验只表示单进程中的一个热点键，初始缓存已预热，命中延迟设为零。队列实验中，拒绝请求始终计为未成功。

p95 只覆盖成功请求，不能脱离失败与拒绝数单独比较。默认参数用于展示现象，不是生产配置建议。详细公式和边界以上方英文规范为准。
