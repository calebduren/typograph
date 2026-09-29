import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { typeset } from '../packages/chat-typography/src/typeset-html';
import { typeset as typesetStatic } from '../packages/chat-typography/src/static';
import { built, dist, packageImports } from './dist-imports';

const nbsp = ' ';
const en = { locale: 'en', spacing: true } as const;
const inputs = [
  '<p>&quot;Hi,&quot; it&#39;s <code>"x"</code></p>',
  '<h1>"Morning," Bob</h1><p>It\'s 30 min &amp; the "annex."</p>',
  '<p lang="fr">"Bonjour"</p><p data-typograph="off">"Keep"</p><p><b>"Bold</b> quote"</p>',
  '<a href="javascript:alert(1)">"x"</a>',
];

describe('@calebduren/typograph/html', () => {
  it('matches /static with input: "html" for both targets and modes', async () => {
    for (const target of ['web', 'email'] as const) {
      for (const html of ['fragment', 'document'] as const) {
        for (const source of inputs) {
          expect(await typeset(source, { target, html, ...en })).toBe(
            await typesetStatic(source, { input: 'html', target, html, ...en }),
          );
        }
      }
    }
  });

  it('typesets quote references and leaves URLs alone', async () => {
    expect(await typeset(inputs[0], { target: 'email', ...en })).toBe(
      '<p>“Hi,” it’s <code>"x"</code></p>',
    );
    expect(await typeset("<p>It's 30 min</p>", { target: 'web', ...en })).toBe(
      `<p>It’s 30${nbsp}min</p>`,
    );
    expect(await typeset(inputs[3], { target: 'web', ...en })).toBe(
      '<a href="javascript:alert(1)">“x”</a>',
    );
  });

  it('accepts input: "html" from /static options', async () => {
    expect(await typeset('<p>"x"</p>', { input: 'html', target: 'web', locale: 'en' })).toBe(
      '<p>“x”</p>',
    );
    await expect(typeset('"x"', { input: 'markdown', target: 'web' } as never)).rejects.toThrow(
      /@calebduren\/typograph\/markdown/,
    );
  });

  it('keeps the /static HTML input rules', async () => {
    await expect(typeset('<p>x</p>', { target: 'markdown' } as never)).rejects.toThrow(TypeError);
    await expect(typeset('<p>x</p>', { target: 'web', hanging: true } as never)).rejects.toThrow(
      /hanging/,
    );
    await expect(typeset('<p>x</p>', { target: 'web', math: true } as never)).rejects.toThrow(
      /math/,
    );
  });

  it.skipIf(!built('typeset-html.js'))(
    'dist/typeset-html.js never names a remark package (skipped until npm run build:chat)',
    async () => {
      const code = readFileSync(join(dist, 'typeset-html.js'), 'utf8');
      expect(code).not.toMatch(
        /remark-parse|remark-gfm|remark-rehype|rehype-stringify|remark-math/,
      );
      expect(await packageImports('typeset-html.js')).toEqual([
        '@typehug/en',
        'rehype-parse',
        'unified',
      ]);
    },
  );
});
