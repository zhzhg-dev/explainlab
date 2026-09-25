# Contributing

Thanks for helping make systems concepts easier to explore.

## Report a model problem

Include the shared scenario URL, the observation time, your expected result, and the relevant model assumption. Screenshots are welcome, but a reproducible scenario is more useful. Please do not include private data or credentials.

## Development

Use Node.js 24+, run `npm ci`, then `npm run dev`. Before submitting, run:

```bash
npm run format
npm run check
npm run build
```

For UI changes, check a narrow phone layout, keyboard navigation, English and Chinese, and reduced-motion behavior. For engine changes, add a meaningful invariant or minimal counterexample test. Explain any semantic change in `docs/MODEL.md`; increment the model URL version when old shared links would otherwise change meaning.

Keep simulations independent of the DOM. Do not share mutable random-number streams between workload generation and policies. A better-looking outcome is not a reason to alter accounting or silently discard failed requests.

## New experiments

Start with an issue describing one concrete failure, two strategies, a fair workload, measurable outcomes, explicit limitations, and a primary reference. Aim for a small experiment that can be understood in one minute.

Contributions are under the project's MIT license. Be respectful, explain disagreements with evidence, and avoid promotional issues or unsolicited star requests.
