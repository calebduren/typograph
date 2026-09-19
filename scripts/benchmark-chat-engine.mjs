import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import typography from '../packages/chat-typography/dist/index.js';

const scenarios = {
  'dense-apostrophes': "'zzzz ",
  'dense-elisions': "Give 'em the cats' bowls. ",
  'dense-code-spans': '`code` "After." ',
  'long-word': 'x',
  'ordinary-prose':
    '"Hello," she said. Give \'em a chance. Wait 30 min; Dr. Smith reviewed Fig. 2. ',
};
const results = [];
for (const [scenario, fragment] of Object.entries(scenarios)) {
  for (const spacing of [false, true]) {
    const transform = typography({ locale: 'en-US', spacing });
    for (const target of [4_000, 16_000, 64_000]) {
      const source = fragment.repeat(Math.ceil(target / fragment.length));
      const samples = [];
      for (let i = 0; i < 43; i++) {
        // Tree construction is outside the timer; only the plugin is measured.
        const tree = {
          type: 'root',
          children: [{ type: 'paragraph', children: [{ type: 'text', value: source }] }],
        };
        const start = performance.now();
        transform(tree, { value: source });
        const elapsed = performance.now() - start;
        if (i >= 3) samples.push(elapsed);
      }
      samples.sort((a, b) => a - b);
      results.push({
        scenario,
        spacing,
        characters: source.length,
        medianMs: +((samples[19] + samples[20]) / 2).toFixed(3),
        p95Ms: +samples[37].toFixed(3),
      });
    }
  }
}
const bundle = await build({
  entryPoints: ['packages/chat-typography/dist/index.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  write: false,
});
const bytes = bundle.outputFiles[0].contents;
console.log(
  JSON.stringify(
    {
      node: process.version,
      cpu: cpus()[0]?.model,
      platform: process.platform,
      warmups: 3,
      samples: 40,
      bundle: {
        minifiedBytes: bytes.length,
        gzipBytes: gzipSync(bytes).length,
        includesTypehug: true,
      },
      results,
    },
    null,
    2,
  ),
);
