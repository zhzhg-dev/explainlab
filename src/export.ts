import type { Comparison, Frame } from './model';
import { VERSION } from './model';
import { titles, strategyA, strategyB, policyNames } from './content';
import type { Language } from './content';
export function exportPng(result: Comparison, index: number, language: Language) {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = 1040;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const zh = language === 'zh',
    i = zh ? 1 : 0,
    t = (en: string, cn: string) => (zh ? cn : en);
  const a = result.a.frames[index],
    b = result.b.frames[index];
  const text = (s: string, x: number, y: number, size = 24, color = '#e5eee8') => {
    ctx.fillStyle = color;
    ctx.font = `${size >= 32 ? 600 : 400} ${size}px system-ui, sans-serif`;
    ctx.fillText(s, x, y);
  };
  ctx.fillStyle = '#101716';
  ctx.fillRect(0, 0, 1440, 1040);
  text('ExplainLab', 64, 70, 28, '#c9f27c');
  text(t('SYSTEMS, MADE VISIBLE', '让系统运行机制变得可见'), 1030, 70, 16, '#9ba9a1');
  text(titles[result.config.experiment][i], 64, 140, 52);
  text(
    `${t('Simulation snapshot', '模拟快照')} · ${(a.time / 1000).toFixed(1)}s · ${t('seed', '随机种子')} ${result.config.seed} · ${t('engine', '引擎')} v${VERSION}`,
    64,
    188,
    22,
    '#9ba9a1',
  );
  const names = [
    strategyA[result.config.experiment][i],
    result.config.experiment === 'retry'
      ? policyNames[result.config.policy][i]
      : strategyB[result.config.experiment][i],
  ];
  [a, b].forEach((f: Frame, j) => {
    const x = 64 + j * 674;
    ctx.fillStyle = '#192320';
    ctx.fillRect(x, 228, 638, 260);
    text(`${j ? 'B' : 'A'}   ${names[j]}`, x + 28, 277, 28, j ? '#c9f27c' : '#fb9d89');
    text(`${f.arrived ? ((100 * f.success) / f.arrived).toFixed(1) : '0.0'}%`, x + 28, 350, 58);
    text(
      `${t('succeeded', '成功')} ${f.success} / ${f.arrived}   ·   ${t('pending', '等待结果')} ${f.pending}`,
      x + 28,
      394,
      21,
    );
    text(
      `${t('failed', '失败')} ${f.failed}  ·  ${t('rejected', '拒绝')} ${f.rejected}  ·  p95 ${Math.round(f.p95)}ms`,
      x + 28,
      442,
      21,
      '#9ba9a1',
    );
  });
  text(t('Backend queue · waiting jobs', '后端队列 · 等待任务数'), 64, 550, 24);
  const max = Math.max(
    5,
    ...result.a.frames.map((f) => f.queued),
    ...result.b.frames.map((f) => f.queued),
  );
  ctx.strokeStyle = '#33433c';
  ctx.lineWidth = 1;
  for (let n = 0; n < 5; n++) {
    const y = 600 + n * 45;
    ctx.beginPath();
    ctx.moveTo(88, y);
    ctx.lineTo(1360, y);
    ctx.stroke();
    text(String(Math.round(max * (1 - n / 4))), 64, y - 6, 15, '#9ba9a1');
  }
  [result.a, result.b].forEach((r, j) => {
    ctx.beginPath();
    r.frames.slice(0, index + 1).forEach((f, k) => {
      const x = 88 + (1272 * f.time) / 45000,
        y = 780 - (180 * f.queued) / max;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = j ? '#c9f27c' : '#fb9d89';
    ctx.lineWidth = 4;
    ctx.stroke();
  });
  text('0s', 88, 812, 17);
  text('45s', 1320, 812, 17);
  const c = result.config;
  text(
    `${t('Load', '流量')} ${c.rate}/s · ${t('service', '处理耗时')} ${c.service}ms · ${t('workers', '并发')} ${c.concurrency} · ${t('timeout', '超时')} ${c.timeout}ms`,
    64,
    870,
    21,
  );
  text(
    `${t('Attempts', '最大尝试')} ${c.attempts} · TTL ${c.ttl}s · ${t('buffer', '等待槽位')} ${c.buffer} · ${t('burst', '突发倍数')} ${c.burst}×`,
    64,
    908,
    21,
  );
  text(
    t(
      'Teaching model, not a production benchmark. p95 includes successful requests only.',
      '教学模拟，不是真实生产基准。p95 只计算成功请求。',
    ),
    64,
    968,
    19,
    '#9ba9a1',
  );
  text('zhzhg-dev.github.io/explainlab', 64, 1005, 19, '#c9f27c');
  const link = document.createElement('a');
  link.download = `explainlab-${c.experiment}-${c.seed}-${Math.round(a.time / 1000)}s.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
