# Launch copy — drafts, not posted

## English

I used Codex to build ExplainLab, a free interactive lab for backend failure patterns. The first version was primarily AI-generated; the code, tests, and model assumptions are public for review.

Run the same traffic through two strategies and watch what happens: fixed retries vs backoff, independent cache misses vs single-flight, and a large queue vs fast rejection. Change the parameters, share a reproducible scenario, or export the result.

It runs in the browser, with no signup or API key. The model has documented simplifications, and I would particularly welcome feedback on those assumptions.

Try it: https://zhzhg-dev.github.io/explainlab/
Code: https://github.com/zhzhg-dev/explainlab

Which failure pattern should become the next experiment?

## 中文

我用 Codex 制作并开源了 ExplainLab：一个可以亲手调参数的后端故障实验室。首版代码主要由 AI 生成，代码、测试和模型假设都已公开，欢迎指出不合理的地方。

同一批请求同时进入两种策略，对比重试风暴、缓存击穿和队列拥堵。你可以观察失败过程、比较真实模拟指标，把参数和随机种子打包成链接分享，或导出结果图片。

浏览器直接运行，不用注册和 API Key。模型假设已公开，尤其欢迎对边界条件和计算方式提出反馈。

在线体验：https://zhzhg-dev.github.io/explainlab/
源代码：https://github.com/zhzhg-dev/explainlab

下一个最值得做成可交互实验的系统故障，你会选什么？

## Suggested repository topics

`system-design` `distributed-systems` `visualization` `simulation` `interactive-learning` `retry` `caching` `queue` `typescript` `react`

## Real demo media

- [Animated replay](images/retry-storm-demo.gif)
- [Static screenshot](images/retry-storm.png)
- [English video](https://github.com/zhzhg-dev/explainlab/releases/download/v0.1.0/explainlab-demo-en.mp4)
- [Video with Chinese captions](https://github.com/zhzhg-dev/explainlab/releases/download/v0.1.0/explainlab-demo-zh.mp4)
- [Short feedback form](https://github.com/zhzhg-dev/explainlab/issues/new?template=feedback.yml)

The approximately 28-second clip is a real run of the deployed app, replayed at 2× speed with captions. The 54.2% vs 91.6% success rates belong to this specific preset and seed; they are not a production benchmark or a universal advantage. Both videos show the English UI, with localized captions.

Use the demo to ask for one concrete observation. Avoid posting identical promotions across unrelated communities. The project does not promise or purchase stars; useful feedback and actual use are better early signals.
