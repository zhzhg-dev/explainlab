import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  ExternalLink,
  FlaskConical,
  Github,
  Layers3,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Timer,
  Zap,
} from 'lucide-react';
import { bounds, defaults, DURATION, parseUrl, shareUrl } from './model';
import type { Comparison, Config, Experiment, Frame } from './model';
import { lessons, policyNames, sources, strategyA, strategyB, subtitles, titles } from './content';
import { exportPng } from './export';

const initial = parseUrl(window.location.href);
const empty: Frame = {
  time: 0,
  arrived: 0,
  success: 0,
  failed: 0,
  rejected: 0,
  pending: 0,
  attempts: 0,
  timeouts: 0,
  active: 0,
  queued: 0,
  peakQueue: 0,
  hits: 0,
  p95: 0,
  average: 0,
  late: 0,
};
const icons = { retry: Zap, cache: Layers3, queue: Timer };
type NumericKey = Exclude<keyof Config, 'experiment' | 'policy'>;
export default function App() {
  const [language, setLanguage] = useState(initial.language),
    [config, setConfig] = useState<Config>(initial.config),
    [result, setResult] = useState<Comparison | null>(null);
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(2),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [share, setShare] = useState('');
  const worker = useRef<Worker | null>(null),
    playAfter = useRef(false);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const zh = language === 'zh',
    l = zh ? 1 : 0,
    t = (en: string, cn: string) => (zh ? cn : en);
  const dirty =
    !!result &&
    Object.keys(config).some(
      (key) => config[key as keyof Config] !== result.config[key as keyof Config],
    );
  const a = result?.a.frames[index] || empty,
    b = result?.b.frames[index] || empty;
  const experiment = config.experiment;
  const compute = (c: Config, play = false) => {
    setPlaying(false);
    setBusy(true);
    setError('');
    playAfter.current = play;
    worker.current?.postMessage(c);
  };
  useEffect(() => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.error) {
        setError(e.data.error);
        setBusy(false);
        return;
      }
      setResult(e.data);
      setIndex(0);
      setBusy(false);
      setPlaying(playAfter.current);
    };
    w.onerror = () => {
      setError('worker');
      setBusy(false);
      setPlaying(false);
    };
    w.postMessage(initial.config);
    return () => w.terminate();
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    if (share && !shareDialog.current?.open) shareDialog.current?.showModal();
  }, [share]);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now(),
      elapsed = index * 200;
    const id = window.setInterval(() => {
      const now = performance.now();
      elapsed += (now - previous) * speed;
      previous = now;
      const next = Math.min(225, Math.floor(elapsed / 200));
      setIndex(next);
      if (next >= 225) setPlaying(false);
    }, 50);
    return () => clearInterval(id);
  }, [playing, speed]); // index intentionally captured when playback starts
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(id);
  }, [notice]);
  const change = (key: NumericKey, value: number) => {
    setPlaying(false);
    setConfig((c) => ({ ...c, [key]: value }));
  };
  const select = (e: Experiment) => {
    const c = { ...defaults[e], seed: config.seed };
    setConfig(c);
    setResult(null);
    setIndex(0);
    compute(c);
  };
  const run = () => {
    if (dirty || !result) {
      compute(config, true);
      return;
    }
    if (index >= 225) setIndex(0);
    setPlaying((p) => !p);
  };
  const reset = () => {
    setPlaying(false);
    if (dirty) compute(config);
    else setIndex(0);
  };
  const copy = async () => {
    const url = shareUrl(config, language, window.location.href);
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t('Scenario link copied', '场景链接已复制'));
    } catch {
      setShare(url);
    }
  };
  const field = (key: NumericKey, label: string, unit: string) => {
    const [min, max, step] = bounds[key];
    return (
      <label className="field" key={key}>
        <span>
          {label}
          <output>
            {config[key]}
            <small>{unit}</small>
          </output>
        </span>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={config[key]}
          onChange={(e) => change(key, Number(e.target.value))}
        />
        <span className="range-ends">
          <span>
            {min}
            {unit}
          </span>
          <span>
            {max}
            {unit}
          </span>
        </span>
      </label>
    );
  };
  const pct = (f: Frame) => (f.arrived ? (100 * f.success) / f.arrived : 0);
  const bName = experiment === 'retry' ? policyNames[config.policy][l] : strategyB[experiment][l];
  const phase =
    a.time === 0
      ? t('Ready to experiment', '准备就绪')
      : a.time >= DURATION
        ? t('Observation complete', '观察结束')
        : experiment === 'retry' && a.time >= 6000 && a.time < 14000
          ? t('Service slowdown · 5×', '服务变慢 · 5 倍')
          : experiment === 'queue' && a.time >= 8000 && a.time < 14000
            ? t(`Traffic burst · ${config.burst}×`, `突发流量 · ${config.burst} 倍`)
            : a.time >= 24000
              ? t('Arrivals stopped · draining', '停止到达 · 清理积压')
              : t('Requests flowing', '请求流入中');
  const card = (f: Frame, side: 'a' | 'b') => (
    <article
      className={`strategy ${side}`}
      aria-label={`${side.toUpperCase()} ${side === 'a' ? strategyA[experiment][l] : bName}`}
    >
      <div className="strategy-heading">
        <span className="letter">{side.toUpperCase()}</span>
        <div>
          <span className="eyebrow">
            {side === 'a' ? t('BASELINE', '基线策略') : t('ALTERNATIVE', '对照策略')}
          </span>
          <h2>{side === 'a' ? strategyA[experiment][l] : bName}</h2>
        </div>
        <span className={`health ${f.queued > config.concurrency ? 'loaded' : ''}`}>
          <i />
          {f.queued > config.concurrency ? t('Under pressure', '压力升高') : t('Nominal', '正常')}
        </span>
      </div>
      <Flow
        frame={f}
        running={playing && !dirty}
        side={side}
        experiment={experiment}
        language={language}
        concurrency={config.concurrency}
      />
      <div className="metric-primary">
        <div>
          <span>{t('Successful requests', '成功请求比例')}</span>
          <strong>
            {pct(f).toFixed(1)}
            <small>%</small>
          </strong>
        </div>
        <div className="metric-fraction">
          {f.success.toLocaleString()} <span>/ {f.arrived.toLocaleString()}</span>
        </div>
      </div>
      <div className="success-track">
        <i style={{ width: `${pct(f)}%` }} />
      </div>
      <div className="metric-grid">
        <div>
          <span>
            {experiment === 'cache'
              ? t('Origin fetches', '回源次数')
              : experiment === 'retry'
                ? t('Request amplification', '请求放大倍数')
                : t('Rejected', '被拒绝')}
          </span>
          <b>
            {experiment === 'cache'
              ? f.attempts
              : experiment === 'retry'
                ? `${f.arrived ? (f.attempts / f.arrived).toFixed(2) : '0.00'}×`
                : f.rejected}
          </b>
        </div>
        <div>
          <span>{t('p95 · successes', 'p95 · 仅成功请求')}</span>
          <b>
            {Math.round(f.p95).toLocaleString()}
            <small> ms</small>
          </b>
        </div>
        <div>
          <span>{t('Peak queue', '队列峰值')}</span>
          <b>{f.peakQueue.toLocaleString()}</b>
        </div>
      </div>
      <div className="accounting">
        <span>
          {t('Failed', '失败')} <b>{f.failed}</b>
        </span>
        <span>
          {t('Rejected', '拒绝')} <b>{f.rejected}</b>
        </span>
        <span>
          {t('Pending', '待完成')} <b>{f.pending}</b>
        </span>
      </div>
    </article>
  );
  return (
    <>
      <a className="skip" href="#lab">
        {t('Skip to experiment', '跳转到实验')}
      </a>
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} width="32" height="32" alt="" />
          Explain<span>Lab</span>
          <sup>beta</sup>
        </a>
        <span className="top-tag">{t('SYSTEMS, MADE VISIBLE', '让系统运行机制变得可见')}</span>
        <nav>
          <button
            className="language"
            onClick={() => setLanguage(zh ? 'en' : 'zh')}
            aria-label={t('Switch to Chinese', '切换到英文')}
          >
            {zh ? 'EN' : '中文'}
          </button>
          <a
            className="github-link"
            href="https://github.com/zhzhg-dev/explainlab"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} />
            <span>GitHub</span>
            <ExternalLink size={13} />
          </a>
        </nav>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <div className="section-label">
            {t('THE EXPERIMENTS', '实验目录')}
            <span>03</span>
          </div>
          <nav className="experiments" aria-label={t('Experiments', '实验')}>
            {(['retry', 'cache', 'queue'] as Experiment[]).map((e, i) => {
              const Icon = icons[e];
              return (
                <button
                  key={e}
                  aria-current={experiment === e ? 'page' : undefined}
                  className={experiment === e ? 'selected' : ''}
                  onClick={() => select(e)}
                  disabled={busy}
                >
                  <span className="experiment-icon">
                    <Icon size={18} />
                  </span>
                  <span>{titles[e][l]}</span>
                  <small>0{i + 1}</small>
                </button>
              );
            })}
          </nav>
          <div className="controls-heading">
            <SlidersHorizontal size={15} />
            <h2>{t('Tune the system', '调整系统')}</h2>
            <button
              className="controls-toggle"
              aria-controls="parameters"
              aria-expanded={controlsOpen}
              onClick={() => setControlsOpen(!controlsOpen)}
            >
              {controlsOpen ? t('Hide', '收起') : t('Show', '展开')}
              <ChevronDown size={13} />
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                const c = { ...defaults[experiment], seed: config.seed };
                setConfig(c);
                compute(c);
              }}
            >
              {t('Defaults', '默认值')}
            </button>
          </div>
          <div id="parameters" className={`parameter-fields ${controlsOpen ? 'open' : ''}`}>
            <div className="controls">
              {field('rate', t('Arrival rate', '请求到达速率'), '/s')}
              {field('service', t('Service time', '单任务处理时间'), 'ms')}
              {field('concurrency', t('Concurrent workers', '并发工作线程'), '')}
              {field('timeout', t('Client timeout', '客户端超时'), 'ms')}
              {experiment === 'retry' && (
                <>
                  {field('attempts', t('Max attempts', '最大尝试次数'), '')}
                  <label className="select-label">
                    {t('Strategy B', 'B 组策略')}
                    <select
                      value={config.policy}
                      onChange={(e) => {
                        setPlaying(false);
                        setConfig((c) => ({ ...c, policy: e.target.value as Config['policy'] }));
                      }}
                    >
                      {Object.entries(policyNames).map(([key, names]) => (
                        <option value={key} key={key}>
                          {names[l]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {experiment === 'cache' && field('ttl', t('Cache TTL', '缓存有效期'), 's')}
              {experiment === 'queue' && (
                <>
                  {field('buffer', t('B · waiting slots', 'B 组等待槽位'), '')}
                  {field('burst', t('Burst multiplier', '突发流量倍数'), '×')}
                </>
              )}
            </div>
            <div className="seed-box">
              <label htmlFor="seed">{t('Random seed', '随机种子')}</label>
              <div>
                <input
                  id="seed"
                  type="number"
                  min="1"
                  max="999999"
                  value={config.seed}
                  onChange={(e) =>
                    change(
                      'seed',
                      Math.max(1, Math.min(999999, Math.round(Number(e.target.value) || 1))),
                    )
                  }
                />
                <button
                  aria-label={t('New random seed', '更换随机种子')}
                  title={t('New random seed', '更换随机种子')}
                  onClick={() => change('seed', 1 + Math.floor(Math.random() * 999998))}
                >
                  <Shuffle size={15} />
                </button>
              </div>
              <p>
                {t(
                  'Same seed. Same arrivals. Fair comparison.',
                  '同一种子，同一批流量，公平对照。',
                )}
              </p>
            </div>
          </div>
          <div className="sidebar-foot">
            <span className="tiny-dot" />
            {t('Runs entirely in your browser', '完全在你的浏览器内运行')}
          </div>
        </aside>
        <main id="lab">
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                <span className="green-dash" />
                {t('INTERACTIVE SYSTEMS LAB', '交互式系统实验室')}
                <span className="slash">/</span>0
                {['retry', 'cache', 'queue'].indexOf(experiment) + 1}
              </div>
              <h1>
                {titles[experiment][l]}
                <span>.</span>
              </h1>
              <p>{subtitles[experiment][l]}</p>
            </div>
            <div className="intro-actions">
              <button onClick={copy}>
                <Copy size={15} />
                {t('Share scenario', '分享场景')}
              </button>
              <button
                title={t('Export current results as PNG', '将当前结果导出为 PNG')}
                disabled={!result || dirty || busy}
                onClick={() => {
                  try {
                    if (result) exportPng(result, index, language);
                    setNotice(t('PNG exported', 'PNG 已导出'));
                  } catch {
                    setError('export');
                  }
                }}
              >
                <ArrowDownToLine size={16} />
                <span>{t('Export', '导出')}</span>
              </button>
            </div>
          </div>
          {initial.invalid && (
            <div className="notice warning">
              {t(
                'This link is invalid or uses an unsupported model version. Loaded the default experiment.',
                '链接无效或模型版本不兼容，已载入默认实验。',
              )}
            </div>
          )}
          {error && (
            <div role="alert" className="notice warning">
              {t('Something went wrong. Reload the page to retry.', '出现错误，请刷新页面重试。')}{' '}
              <code>{error}</code>
            </div>
          )}
          <section className="workbench" aria-label={t('Simulation workbench', '模拟实验台')}>
            <div className="transport">
              <div className="transport-buttons">
                <button className="primary" disabled={busy} onClick={run}>
                  {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                  {busy
                    ? t('Preparing…', '准备中…')
                    : playing
                      ? t('Pause', '暂停')
                      : dirty
                        ? t('Run changes', '运行新参数')
                        : index >= 225
                          ? t('Run again', '重新运行')
                          : index > 0
                            ? t('Continue', '继续')
                            : t('Run experiment', '运行实验')}
                </button>
                <button
                  className="icon-button"
                  disabled={busy}
                  onClick={reset}
                  title={t('Reset playback', '重置播放')}
                  aria-label={t('Reset playback', '重置播放')}
                >
                  <RotateCcw size={16} />
                </button>
                <label className="speed">
                  <span className="sr-only">{t('Playback speed', '播放速度')}</span>
                  <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                    <option value="1">1×</option>
                    <option value="2">2×</option>
                    <option value="4">4×</option>
                    <option value="8">8×</option>
                  </select>
                </label>
              </div>
              <div className="live-status">
                <span className={playing ? 'pulse-dot' : 'tiny-dot'} />
                <span>
                  {dirty
                    ? t('Parameters changed · rerun required', '参数已改变 · 请重新运行')
                    : phase}
                </span>
              </div>
              <span className="clock">
                {(a.time / 1000).toFixed(1)}
                <span> / 45s</span>
              </span>
            </div>
            <div className={`comparison ${dirty ? 'stale' : ''}`} aria-busy={busy}>
              {card(a, 'a')}
              {card(b, 'b')}
            </div>
            <div className="timeline">
              <input
                aria-label={t('Simulation time', '模拟时间')}
                type="range"
                min="0"
                max="225"
                value={index}
                disabled={!result || dirty || busy}
                onChange={(e) => {
                  setPlaying(false);
                  setIndex(Number(e.target.value));
                }}
              />
              <div className="timeline-labels">
                <span>0s</span>
                <span>
                  {experiment === 'cache'
                    ? t('TTL expiries throughout', '周期性缓存过期')
                    : experiment === 'retry'
                      ? t('6–14s · slowdown', '6–14s · 服务变慢')
                      : t('8–14s · burst', '8–14s · 流量突发')}
                </span>
                <span>{t('24s · arrivals stop', '24s · 停止请求')}</span>
                <button
                  disabled={!result || dirty || busy}
                  onClick={() => {
                    setPlaying(false);
                    setIndex(225);
                  }}
                >
                  {t('See outcome', '查看结果')}
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </section>
          <section className="telemetry">
            <div className="panel-title">
              <div>
                <Radio size={16} />
                <h2>{t('Pressure over time', '压力随时间变化')}</h2>
                <span>{t('backend queue', '后端等待队列')}</span>
              </div>
              <div className="legend">
                <span>
                  <i className="a-dot" />A
                </span>
                <span>
                  <i className="b-dot" />B
                </span>
              </div>
            </div>
            <QueueChart result={result} index={index} language={language} />
          </section>
          {index > 0 && (
            <div className="insight" role="status" aria-live={playing ? 'off' : 'polite'}>
              <FlaskConical size={19} />
              <div>
                <strong>{t('Read the whole result', '完整地理解结果')}</strong>
                <p>
                  {t(
                    `A: ${a.success} succeeded, ${a.failed} failed, ${a.rejected} rejected. B: ${b.success} succeeded, ${b.failed} failed, ${b.rejected} rejected. ${a.pending + b.pending} requests are still pending across both groups.`,
                    `A 组：成功 ${a.success}、失败 ${a.failed}、拒绝 ${a.rejected}。B 组：成功 ${b.success}、失败 ${b.failed}、拒绝 ${b.rejected}。两组共 ${a.pending + b.pending} 个请求仍在等待结果。`,
                  )}
                </p>
              </div>
            </div>
          )}
          <section className="explanation">
            <div className="explanation-title">
              <CircleHelp size={18} />
              <h2>{t('What is happening here?', '这里发生了什么？')}</h2>
            </div>
            <div className="lesson-columns">
              <div>
                <h3>{lessons[experiment][0][l]}</h3>
                <p>{lessons[experiment][1][l]}</p>
              </div>
              <div>
                <h3>{lessons[experiment][2][l]}</h3>
                <p>{lessons[experiment][3][l]}</p>
              </div>
            </div>
            <details>
              <summary>
                {t('Model assumptions & sources', '模型假设与参考资料')}
                <ChevronDown size={15} />
              </summary>
              <div className="model-notes">
                <p>
                  {t(
                    'This is a discrete-event teaching model, not a production benchmark. Arrivals follow a seeded Poisson process for 24 seconds; observation ends at 45 seconds. FIFO workers have ±20% service-time variation. Work continues after a client timeout. Any unfinished requests remain pending, never silently counted as failures.',
                    '这是离散事件教学模型，不是真实生产基准。前 24 秒按固定随机种子的泊松过程产生请求，第 45 秒结束观察。FIFO 工作线程的耗时有 ±20% 变化。客户端超时后，服务端仍继续处理任务；观察结束时未完成的请求保留为待完成，不会被悄悄算作失败。',
                  )}
                </p>
                <p>
                  {t(
                    'p95 and success latency exclude failed, rejected and pending requests. A request can succeed at most once. Cache hits have zero modeled latency; network delay, CPU scheduling, distributed locks and real provider behavior are not simulated.',
                    'p95 和成功延迟不包含失败、拒绝、待完成请求。每个原始请求最多成功一次。缓存命中延迟在模型中设为零；不模拟网络延迟、CPU 调度、分布式锁或具体云服务商的行为。',
                  )}
                </p>
                {experiment === 'retry' && (
                  <p>
                    {t(
                      'Each attempt gets a fresh timeout. A late response cannot rescue an expired attempt. Fixed retries wait 100ms; exponential backoff starts at 500ms and caps at 4s. Full jitter samples uniformly from zero to that cap. Max attempts includes the initial request. Only safe, idempotent operations are represented.',
                      '每次尝试都有独立超时期限。超时后的响应不能挽救该次尝试。固定重试等待 100ms；指数退避从 500ms 起步，最高 4s；完全随机抖动在零到当前退避上限之间均匀采样。最大尝试次数包含首次请求。这里只表示安全、幂等的操作。',
                    )}
                  </p>
                )}
                <div className="source-links">
                  {sources[experiment].map((s) => (
                    <a key={s.href} href={s.href} target="_blank" rel="noreferrer">
                      {s.label}
                      <ExternalLink size={12} />
                    </a>
                  ))}
                  <a
                    href="https://github.com/zhzhg-dev/explainlab/blob/main/docs/MODEL.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('Full model documentation', '完整模型说明')}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </details>
          </section>
          <footer>
            <span>
              ExplainLab <span className="muted">v0.1.0 · MIT</span>
            </span>
            <span>
              {t('Change a variable. Build an intuition.', '改变一个变量，建立一种直觉。')}
            </span>
            <a
              href="https://github.com/zhzhg-dev/explainlab/issues"
              target="_blank"
              rel="noreferrer"
            >
              {t('Suggest an experiment', '提出实验建议')}
              <ArrowRight size={13} />
            </a>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {share && (
        <dialog
          ref={shareDialog}
          onCancel={() => setShare('')}
          aria-labelledby="share-title"
          className="share-dialog"
        >
          <h2 id="share-title">{t('Copy this scenario link', '复制场景链接')}</h2>
          <textarea autoFocus readOnly value={share} onFocus={(e) => e.target.select()} />
          <button className="primary" onClick={() => setShare('')}>
            {t('Done', '完成')}
          </button>
        </dialog>
      )}
    </>
  );
}
function Flow({
  frame: f,
  running,
  side,
  experiment,
  language,
  concurrency,
}: {
  frame: Frame;
  running: boolean;
  side: 'a' | 'b';
  experiment: Experiment;
  language: string;
  concurrency: number;
}) {
  const zh = language === 'zh';
  return (
    <div className={`flow ${running ? 'running' : ''}`}>
      <div className="flow-node client">
        <span className="node-icon">↗</span>
        <b>{zh ? '客户端' : 'Clients'}</b>
        <small>
          {f.arrived.toLocaleString()} {zh ? '到达' : 'arrivals'}
        </small>
      </div>
      <div className="connector">
        <span />
        <i />
        <i />
        <i />
      </div>
      <div className="flow-node queue">
        <div className="queue-dots">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} className={i < Math.min(12, f.queued) ? 'filled' : ''} />
          ))}
        </div>
        <b>
          {experiment === 'cache'
            ? zh
              ? '缓存 / 队列'
              : 'Cache / queue'
            : zh
              ? '等待队列'
              : 'Queue'}
        </b>
        <small>
          {f.queued} {zh ? '等待' : 'waiting'}
        </small>
      </div>
      <div className="connector">
        <span />
        <i />
        <i />
      </div>
      <div className={`flow-node server ${f.active >= concurrency ? 'full' : ''}`}>
        <div className="server-icon">
          <i />
          <i />
          <i />
        </div>
        <b>{zh ? '服务端' : 'Workers'}</b>
        <small>
          {f.active} / {concurrency} {zh ? '工作中' : 'busy'}
        </small>
      </div>
      <div className="flow-caption">
        {side === 'a' ? (zh ? '基线策略' : 'baseline') : zh ? '对照策略' : 'alternative'}
        <span>
          {running ? (zh ? '正在模拟' : 'simulating') : zh ? '模拟视图' : 'simulation view'}
        </span>
      </div>
    </div>
  );
}
function QueueChart({
  result,
  index,
  language,
}: {
  result: Comparison | null;
  index: number;
  language: string;
}) {
  const max = Math.max(
    5,
    ...(result?.a.frames.map((f) => f.queued) || []),
    ...(result?.b.frames.map((f) => f.queued) || []),
  );
  const path = (frames: Frame[]) =>
    frames
      .slice(0, index + 1)
      .map(
        (f, i) =>
          `${i ? 'L' : 'M'}${48 + (f.time / DURATION) * 900},${150 - (f.queued / max) * 126}`,
      )
      .join(' ');
  const fault =
    result?.config.experiment === 'retry'
      ? [6000, 14000]
      : result?.config.experiment === 'queue'
        ? [8000, 14000]
        : null;
  return (
    <svg
      className="queue-chart"
      viewBox="0 0 990 184"
      role="img"
      aria-label={
        language === 'zh'
          ? '两种策略的后端等待队列随时间变化'
          : 'Backend queue over time for both strategies'
      }
    >
      <title>
        {language === 'zh'
          ? 'A 组为珊瑚色，B 组为绿色。队列峰值也在上方指标中列出。'
          : 'A is coral; B is green. Peak queue values are also listed above.'}
      </title>
      {fault && (
        <rect
          x={48 + (fault[0] / DURATION) * 900}
          y="15"
          width={((fault[1] - fault[0]) / DURATION) * 900}
          height="135"
          fill="#fb9d8909"
        />
      )}
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line
            x1="48"
            x2="948"
            y1={150 - v * 126}
            y2={150 - v * 126}
            stroke="#293730"
            strokeDasharray="3 5"
          />
          <text x="34" y={154 - v * 126} textAnchor="end">
            {Math.round(v * max)}
          </text>
        </g>
      ))}
      {[0, 10, 20, 30, 40, 45].map((s) => (
        <text key={s} x={48 + (s / 45) * 900} y="176" textAnchor="middle">
          {s}s
        </text>
      ))}
      {result && (
        <>
          <path d={path(result.a.frames)} stroke="#f6a08c" />
          <path d={path(result.b.frames)} stroke="#c9f27c" />
          <line
            x1={48 + (index / 225) * 900}
            x2={48 + (index / 225) * 900}
            y1="15"
            y2="150"
            stroke="#ffffff30"
          />
        </>
      )}
    </svg>
  );
}
