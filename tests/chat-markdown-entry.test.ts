import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import remarkMath from 'remark-math';
import { typeset } from '../packages/chat-typography/src/markdown';
import { typeset as typesetStatic } from '../packages/chat-typography/src/static';
import { built, dist, packageImports } from './dist-imports';

const en = { locale: 'en', spacing: true } as const;
const inputs = [
  '# "Morning" brief\n\n"Revenue" rose to $5 and it\'s 30 min.',
  '| A |\n| - |\n| "x" |\n\n- [x] "Done"\n\n~~"old"~~[^1]\n\n[^1]: "Note."',
  'Wait [the "brief"](javascript:alert(1)) and ![alt](data:x) now.',
  "See [the guide](https://example.com/it's) and `it's`.",
];

describe('@calebduren/typograph/markdown', () => {
  it('matches /static for every target', async () => {
    for (const target of ['web', 'email', 'markdown'] as const) {
      for (const source of inputs) {
        expect(await typeset(source, { target, ...en })).toBe(
          await typesetStatic(source, { target, ...en }),
        );
      }
    }
    expect(await typeset(inputs[0], { target: 'web', ...en, hanging: false })).toBe(
      await typesetStatic(inputs[0], { target: 'web', ...en, hanging: false }),
    );
  });

  it('adds hanging markup for web unless turned off', async () => {
    expect(await typeset('"Hi"', { target: 'web', ...en })).toBe(
      '<p data-typograph-hanging=""><span class="typograph-opening"><span>“</span></span>Hi”</p>',
    );
    expect(await typeset('"Hi"', { target: 'web', ...en, hanging: false })).toBe('<p>“Hi”</p>');
    expect(await typeset('"Hi"', { target: 'email', ...en })).toBe('<p>“Hi”</p>');
  });

  it('drops unsafe URLs from HTML output and keeps them in Markdown output', async () => {
    const source = '[click](javascript:alert(1))';
    expect(await typeset(source, { target: 'web', ...en })).toBe('<p><a>click</a></p>');
    expect(await typeset(source, { target: 'email', ...en })).toBe('<p><a>click</a></p>');
    expect(await typeset(source, { target: 'markdown', ...en })).toBe(source);
  });

  it('parses math with an injected remark-math plugin', async () => {
    const source = 'The derivative $f\'(x)$ is "steep."';
    const output = await typeset(source, { target: 'web', ...en, math: remarkMath });
    expect(output).toContain('<code class="language-math math-inline">f\'(x)</code>');
    expect(output).toBe(await typesetStatic(source, { target: 'web', ...en, math: true }));
    expect(await typeset('$x$', { target: 'email', math: remarkMath })).toContain('math-inline');
    expect(
      await typeset('Say $x\'$ and "go."', { target: 'markdown', ...en, math: remarkMath }),
    ).toBe("Say $x'$ and “go.”");
    // /static accepts the plugin too.
    expect(await typesetStatic(source, { target: 'web', ...en, math: remarkMath })).toBe(output);
    expect(await typeset('$x$', { target: 'email' })).toBe('<p>$x$</p>');
  });

  it('rejects math: true with the fix', async () => {
    await expect(typeset('$x$', { target: 'web', math: true } as never)).rejects.toThrow(
      new TypeError(
        'typeset() from @calebduren/typograph/markdown takes the remark-math plugin as math: import remarkMath from "remark-math" and pass math: remarkMath.',
      ),
    );
    await expect(typeset('$x$', { target: 'web', math: 'yes' } as never)).rejects.toThrow(
      TypeError,
    );
    expect(await typeset('$x$', { target: 'email', math: false } as never)).toBe('<p>$x$</p>');
  });

  it('points HTML input at the html entry', async () => {
    await expect(typeset('<p>"x"</p>', { input: 'html', target: 'web' } as never)).rejects.toThrow(
      /@calebduren\/typograph\/html/,
    );
    await expect(typeset('<p>"x"</p>', { input: 'html', target: 'web' } as never)).rejects.toThrow(
      TypeError,
    );
    expect(await typeset('"x"', { input: 'markdown', target: 'markdown', ...en } as never)).toBe(
      '“x”',
    );
  });

  it('rejects a missing or unknown target', async () => {
    await expect(typeset('"x"', {} as never)).rejects.toThrow(TypeError);
    await expect(typeset('"x"', { target: 'pdf' } as never)).rejects.toThrow(/target/);
  });

  it.skipIf(!built('markdown.js'))(
    'dist/markdown.js never names rehype-parse or remark-math (skipped until npm run build:chat)',
    async () => {
      const code = readFileSync(join(dist, 'markdown.js'), 'utf8');
      expect(code).not.toMatch(/rehype-parse|remark-math/);
      expect(await packageImports('markdown.js')).toEqual([
        '@typehug/en',
        'rehype-stringify',
        'remark-gfm',
        'remark-parse',
        'remark-rehype',
        'unified',
      ]);
    },
  );
});
