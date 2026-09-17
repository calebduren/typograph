import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { performance } from 'node:perf_hooks';
import { Streamdown, defaultRemarkPlugins } from 'streamdown';
import remarkChatTypography from '../packages/chat-typography/dist/index.js';

const fragment = `"Hello," she said. Give 'em a chance. Wait 30 min; Dr. Smith reviewed Fig. 2. Read [the guide](https://example.com/it's-here) and keep \`const x = "hi"\`.\n\n`;
const defaults = Object.values(defaultRemarkPlugins);
const candidate = [
  ...defaults,
  [remarkChatTypography, { locale: 'en', phase: 'streaming', spacing: true }],
];

function render(source, plugins) {
  return renderToStaticMarkup(
    React.createElement(
      Streamdown,
      {
        mode: 'static',
        controls: false,
        remarkPlugins: plugins,
      },
      source,
    ),
  );
}
function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { medianMs: Number(sorted[20].toFixed(2)), p95Ms: Number(sorted[37].toFixed(2)) };
}
const results = [];
for (const size of [1_000, 10_000]) {
  const source = fragment.repeat(Math.ceil(size / fragment.length));
  for (let i = 0; i < 8; i++) {
    render(source, defaults);
    render(source, candidate);
  }
  const samples = { baseline: [], candidate: [] };
  for (let i = 0; i < 40; i++) {
    for (const [name, plugins] of i % 2
      ? [
          ['candidate', candidate],
          ['baseline', defaults],
        ]
      : [
          ['baseline', defaults],
          ['candidate', candidate],
        ]) {
      const start = performance.now();
      render(source, plugins);
      samples[name].push(performance.now() - start);
    }
  }
  results.push({
    inputCharacters: source.length,
    iterationsPerVariant: 40,
    baseline: summarize(samples.baseline),
    candidate: summarize(samples.candidate),
  });
}
console.log(JSON.stringify(results, null, 2));
