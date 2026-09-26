import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// `npm run check` packs into release/check/, which is scratch space. Only
// `npm run pack:release` (this script with --release) writes a versioned
// archive to release/, and never over an existing file or a published version.
const release = process.argv.includes('--release');
const root = process.cwd();
const dir = mkdtempSync(join(tmpdir(), 'typograph-chat-consumer-'));
const checkDir = resolve('release/check');
const exec = (command, args, cwd = dir) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const { name: packageName, version } = JSON.parse(
  readFileSync(join(root, 'packages/chat-typography/package.json'), 'utf8'),
);
const releaseName = `${packageName.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;
const releasePath = resolve('release', releaseName);
const refuse = (message) => {
  console.error(`pack:release refused: ${message}`);
  process.exit(1);
};
if (release) {
  if (existsSync(releasePath))
    refuse(`release/${releaseName} already exists. Release archives are never overwritten.`);
  let published = false;
  try {
    published =
      exec(
        'npm',
        [
          'view',
          `${packageName}@${version}`,
          'version',
          '--fetch-retries',
          '1',
          '--fetch-timeout',
          '20000',
        ],
        root,
      ).trim() !== '';
  } catch (error) {
    // npm reports an unpublished version as E404; anything else (offline,
    // timeout, registry trouble) is not an answer, so packing continues.
    if (!/\bE404\b/.test(`${error.stderr ?? ''}`)) {
      const reason = `${error.stderr || error.message}`.trim().split('\n')[0];
      console.warn(
        `Warning: could not ask the registry about ${packageName}@${version}: ${reason}`,
      );
    }
  }
  if (published)
    refuse(
      `${packageName}@${version} is already on the registry. Bump the version before packing a release.`,
    );
}

mkdirSync(checkDir, { recursive: true });
for (const file of readdirSync(checkDir))
  if (file.endsWith('.tgz')) rmSync(join(checkDir, file), { force: true });
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
      checkDir,
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
  join(checkDir, pack.filename),
  'unified@11.0.5',
  'remark-parse@11.0.0',
  'remark-gfm@4.0.1',
  'remark-math@6.0.0',
  'remark-rehype@11.1.2',
  'rehype-stringify@10.0.1',
  'rehype-parse@9.0.1',
]);
writeFileSync(
  join(dir, 'consumer.mjs'),
  `
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import typography, { rehypeTypography, typesetText } from '@calebduren/typograph';
import hanging from '@calebduren/typograph/hanging';
import { typeset } from '@calebduren/typograph/static';
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
assert.equal(typesetText("Bob's \\"brief\\" takes 30 min", { locale: 'en', spacing: true }), 'Bob’s “brief” takes 30\\u00a0min');
const brief = "\\"Morning\\" brief: it's 30 min.";
const web = await typeset(brief, { target: 'web', locale: 'en', spacing: true });
assert.ok(web.startsWith('<p data-typograph-hanging=""><span class="typograph-opening"><span>“</span></span>Morning” brief'));
const email = await typeset(brief, { target: 'email', locale: 'en', spacing: true });
assert.equal(email, '<p>“Morning” brief: it’s 30\\u00a0min.</p>');
assert.equal(await typeset('*"Hi"*', { target: 'markdown', locale: 'en' }), '*“Hi”*');
assert.equal(
  await typeset('<p>&quot;Hi,&quot; it&#39;s <code>"x"</code></p>', { input: 'html', target: 'email', locale: 'en' }),
  '<p>“Hi,” it’s <code>"x"</code></p>',
);
const hastTree = { type: 'root', children: [{ type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: '"Hi"' }] }] };
rehypeTypography({ locale: 'en' })(hastTree);
assert.equal(hastTree.children[0].children[0].value, '“Hi”');
console.log('Packed chat plugin + generic Remark pipeline + static entry + HTML input: passed');
`,
);
writeFileSync(
  join(dir, 'consumer.mts'),
  `
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import typography, { typesetText, type ChatTypographyOptions, type TypesetTextOptions } from '@calebduren/typograph';
import hanging, { type HangingPunctuationOptions } from '@calebduren/typograph/hanging';
import { typeset as typesetStatic, type HtmlTypesetOptions, type TypesetOptions } from '@calebduren/typograph/static';
import { rehypeTypography, type HtmlTypographyOptions } from '@calebduren/typograph';
const options: ChatTypographyOptions = { locale: 'en-GB', skip: node => node.type === 'link' };
unified().use(remarkParse).use(typography, options);
const hangingOptions: HangingPunctuationOptions = { locale: 'en', skip: node => node.type === 'element' && node.tagName === 'code' };
unified().use(hanging, hangingOptions);
const textOptions: TypesetTextOptions = { locale: 'en', phase: 'complete', spacing: true };
const typeset: string = typesetText('"Hi"', textOptions);
const staticOptions: TypesetOptions = { target: 'email', locale: 'en', math: false };
const typesetHtml: Promise<string> = typesetStatic('"Hi"', staticOptions);
const htmlOptions: HtmlTypesetOptions = { input: 'html', target: 'web', locale: 'en', html: 'document', hanging: false };
const typesetFromHtml: Promise<string> = typesetStatic('<p>"Hi"</p>', htmlOptions);
// @ts-expect-error Hanging needs new markup, so HTML input rejects it.
const htmlHanging: HtmlTypesetOptions = { input: 'html', target: 'web', hanging: true };
// @ts-expect-error HTML input cannot produce Markdown.
const htmlMarkdown: HtmlTypesetOptions = { input: 'html', target: 'markdown' };
const rehypeOptions: HtmlTypographyOptions = { locale: 'en', skip: node => node.type === 'element' && node.tagName === 'aside' };
rehypeTypography(rehypeOptions);
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
const peers = [
  'rehype-parse',
  'rehype-stringify',
  'remark-gfm',
  'remark-math',
  'remark-parse',
  'remark-rehype',
  'unified',
];
assert.deepEqual(Object.keys(manifest.peerDependencies).sort(), peers);
for (const peer of peers) assert.deepEqual(manifest.peerDependenciesMeta[peer], { optional: true });

// Without peers, every entry still imports and typeset() names what to install.
const bare = mkdtempSync(join(tmpdir(), 'typograph-chat-peerless-'));
writeFileSync(
  join(bare, 'package.json'),
  JSON.stringify({ name: 'chat-peerless-consumer', private: true, type: 'module' }),
);
exec(
  'npm',
  [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--cache',
    join(dir, 'npm-cache'),
    join(checkDir, pack.filename),
  ],
  bare,
);
for (const peer of peers)
  assert.ok(!existsSync(join(bare, 'node_modules', peer)), `${peer} was installed`);
writeFileSync(
  join(bare, 'peerless.mjs'),
  `
import assert from 'node:assert/strict';
import { typesetText } from '@calebduren/typograph';
await import('@calebduren/typograph/hanging');
const { typeset } = await import('@calebduren/typograph/static');
assert.equal(typesetText('"Hi"', { locale: 'en' }), '“Hi”');
await assert.rejects(typeset('"Hi"', { target: 'web', locale: 'en' }), {
  message: '@calebduren/typograph/static needs these packages for target "web": unified, remark-parse, remark-gfm, remark-rehype, rehype-stringify. Install them alongside @calebduren/typograph.',
});
await assert.rejects(typeset('<p>"Hi"</p>', { input: 'html', target: 'web', locale: 'en' }), {
  message: '@calebduren/typograph/static needs these packages for target "web" with input "html": unified, rehype-parse. Install them alongside @calebduren/typograph.',
});
console.log('Peerless consumer: entries import; typeset() names missing peers');
`,
);
console.log(exec(process.execPath, ['peerless.mjs'], bare).trim());
writeFileSync(
  join(checkDir, 'chat-package-check.json'),
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
        'plain-string API',
        'static entry',
        'optional peers',
        'HTML input',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Chat TypeScript and clean consumer passed. Tested tarball: release/check/' + pack.filename,
);

if (release) {
  assert.equal(pack.filename, releaseName);
  // COPYFILE_EXCL makes the copy itself refuse to replace an archive, even one
  // that appeared while the checks ran.
  try {
    copyFileSync(join(checkDir, pack.filename), releasePath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code === 'EEXIST')
      refuse(`release/${releaseName} already exists. Release archives are never overwritten.`);
    throw error;
  }
  const bytes = readFileSync(releasePath);
  const shasum = createHash('sha1').update(bytes).digest('hex');
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  assert.equal(shasum, pack.shasum);
  assert.equal(integrity, pack.integrity);
  console.log(`Release archive: release/${releaseName}`);
  console.log(`  shasum (sha1):      ${shasum}`);
  console.log(`  integrity (sha512): ${integrity}`);
  console.log(
    `After publishing, compare with: npm view ${packageName}@${version} dist.shasum dist.integrity`,
  );
}
