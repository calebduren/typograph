import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const dir = mkdtempSync(join(tmpdir(), 'typograph-chat-consumer-'));
const exec = (command, args, cwd = dir) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const [pack] = JSON.parse(
  exec(
    'npm',
    [
      'pack',
      '--json',
      '--ignore-scripts',
      '--cache',
      join(dir, 'npm-cache'),
      '--pack-destination',
      dir,
      '-w',
      '@calebduren/typograph',
    ],
    root,
  ),
);
for (const file of pack.files) {
  assert.match(file.path, /^(dist\/|README\.md$|LICENSE$|THIRD_PARTY_NOTICES\.md$|package\.json$)/);
}
writeFileSync(
  join(dir, 'package.json'),
  JSON.stringify({ name: 'chat-clean-consumer', private: true, type: 'module' }),
);
exec('npm', [
  'install',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  '--save-exact',
  '--cache',
  join(dir, 'npm-cache'),
  join(dir, pack.filename),
  'unified@11.0.5',
  'remark-parse@11.0.0',
]);
writeFileSync(
  join(dir, 'consumer.mjs'),
  `
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import typography from '@calebduren/typograph';
import hanging from '@calebduren/typograph/hanging';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const source = ${JSON.stringify('"Read [the guide](https://example.com/it\'s-here) today." Wait 30 min.')};
const processor = unified().use(remarkParse).use(typography, { locale: 'en-US' });
const tree = processor.runSync(processor.parse(source), source);
const visible = node => node.value ?? (node.children ?? []).map(visible).join('');
assert.equal(visible(tree), '“Read the guide today.” Wait 30 min.');
assert.equal(tree.children[0].children[1].url, "https://example.com/it's-here");
const htmlTree = { type: 'root', children: [{ type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: '“Hello.”' }] }] };
hanging({ locale: 'en' })(htmlTree);
assert.equal(htmlTree.children[0].children[0].properties.className[0], 'typograph-opening');
assert.ok(existsSync(fileURLToPath(import.meta.resolve('@calebduren/typograph/hanging.css'))));
console.log('Packed chat plugin + generic Remark pipeline: passed');
`,
);
writeFileSync(
  join(dir, 'consumer.mts'),
  `
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import typography, { type ChatTypographyOptions } from '@calebduren/typograph';
import hanging, { type HangingPunctuationOptions } from '@calebduren/typograph/hanging';
const options: ChatTypographyOptions = { locale: 'en-GB', skip: node => node.type === 'link' };
unified().use(remarkParse).use(typography, options);
const hangingOptions: HangingPunctuationOptions = { locale: 'en', skip: node => node.type === 'element' && node.tagName === 'code' };
unified().use(hanging, hangingOptions);
`,
);
console.log(exec(process.execPath, ['consumer.mjs']).trim());
exec(process.execPath, [
  join(root, 'node_modules/typescript/bin/tsc'),
  '--noEmit',
  '--strict',
  '--target',
  'ES2022',
  '--module',
  'NodeNext',
  '--moduleResolution',
  'NodeNext',
  'consumer.mts',
]);
const manifest = JSON.parse(
  readFileSync(join(dir, 'node_modules/@calebduren/typograph/package.json'), 'utf8'),
);
assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
  '@typehug/en',
  '@types/hast',
  '@types/mdast',
]);
assert.deepEqual(manifest.sideEffects, ['./dist/hanging.css']);
assert.ok(!manifest.scripts?.postinstall);
mkdirSync(resolve('release'), { recursive: true });
copyFileSync(join(dir, pack.filename), resolve('release', pack.filename));
writeFileSync(
  resolve('release/chat-package-check.json'),
  JSON.stringify(
    {
      version: manifest.version,
      tarball: pack.filename,
      integrity: pack.integrity,
      bytes: pack.size,
      unpackedBytes: pack.unpackedSize,
      checks: [
        'ESM',
        'generic Remark',
        'public TypeScript without skipLibCheck',
        'declared dependencies',
        'package file allowlist',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log('Chat TypeScript and clean consumer passed. Tested tarball: release/' + pack.filename);
