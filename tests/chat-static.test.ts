import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkChatTypography, {
  type ChatTypographyOptions,
} from '../packages/chat-typography/src/index';
import { typeset } from '../packages/chat-typography/src/static';
import { createTypeset, type Peers } from '../packages/chat-typography/src/static-core';

const cases = JSON.parse(
  readFileSync(new URL('../validation/cases.json', import.meta.url), 'utf8'),
) as { id: string; input: string; locale?: string }[];
const nbsp = '\u00a0';
const en = { locale: 'en', spacing: true } as const;

const visible = (node: any): string => {
  if (['text', 'inlineCode', 'code', 'math', 'inlineMath'].includes(node.type)) return node.value;
  if (node.type === 'break') return '\n';
  return (node.children ?? []).map(visible).join(node.type === 'root' ? '\n\n' : '');
};
const parse = (markdown: string) => unified().use(remarkParse).use(remarkGfm).parse(markdown);
function engine(markdown: string, options: ChatTypographyOptions) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkChatTypography, { phase: 'complete', ...options });
  return visible(processor.runSync(processor.parse(markdown), markdown));
}
const html = (markdown: string, options: object = {}) =>
  typeset(markdown, { target: 'web', ...en, ...options });
const md = (markdown: string, options: object = {}) =>
  typeset(markdown, { target: 'markdown', ...en, ...options });

const brief = [
  '# "Morning" brief',
  '',
  '"Revenue" rose to $5 and it\'s 30 min to J. R. R. Tolkien\'s office.',
  '',
  '| Name | Note |',
  '| --- | --- |',
  '| "Acme" | it\'s done |',
  '',
  '- [ ] "Call" Bob',
  '',
  "See [the guide](https://example.com/it's) and `it's`.[^1]",
  '',
  '```',
  'say "hi"',
  '```',
  '',
  '[^1]: "Source."',
].join('\n');

describe('typeset targets', () => {
  it('web: typeset HTML with hanging markup and intact literals', async () => {
    const output = await html(brief);
    expect(output).toContain(
      '<p data-typograph-hanging=""><span class="typograph-opening"><span>“</span></span>Revenue” rose',
    );
    expect(output).toContain(`it’s 30${nbsp}min to J.${nbsp}R.`);
    expect(output).toContain('<td>“Acme”</td>');
    expect(output).toContain('href="https://example.com/it&#x27;s"');
    expect(output).toContain("<code>it's</code>");
    expect(output).toContain('say "hi"');
  });

  it('email: identical to web without hanging markup', async () => {
    const web = await html(brief);
    const email = await typeset(brief, { target: 'email', ...en, hanging: true });
    expect(email).not.toContain('typograph-opening');
    expect(email).toBe(
      web
        .replace(/<span class="typograph-opening"><span>(.)<\/span><\/span>/g, '$1')
        .replaceAll(' data-typograph-hanging=""', ''),
    );
  });

  it('markdown: typeset source with formatting preserved', async () => {
    expect(await md(brief)).toBe(
      [
        '# “Morning” brief',
        '',
        `“Revenue” rose to $5 and it’s 30${nbsp}min to J.${nbsp}R.${nbsp}R. Tolkien’s office.`,
        '',
        '| Name | Note |',
        '| --- | --- |',
        '| “Acme” | it’s done |',
        '',
        '- [ ] “Call” Bob',
        '',
        "See [the guide](https://example.com/it's) and `it's`.[^1]",
        '',
        '```',
        'say "hi"',
        '```',
        '',
        '[^1]: “Source.”',
      ].join('\n'),
    );
  });

  it('rejects a missing or unknown target', async () => {
    await expect(typeset('"x"', {} as never)).rejects.toThrow(TypeError);
    await expect(typeset('"x"', { target: 'pdf' } as never)).rejects.toThrow(/target/);
  });
});

describe('supported syntax', () => {
  it('parses GFM strikethrough and footnotes so quotes pair', async () => {
    expect(await md('~~"old"~~ and "new"[^1]\n\n[^1]: Note.')).toBe(
      '~~“old”~~ and “new”[^1]\n\n[^1]: Note.',
    );
  });

  it('parses GFM tables and task lists', async () => {
    const output = await html('| A |\n| - |\n| "x" |\n\n- [x] "Done"', { hanging: false });
    expect(output).toContain('<td>“x”</td>');
    expect(output).toContain('<input type="checkbox" checked disabled> “Done”');
  });

  it('keeps currency as prose by default', async () => {
    expect(await html('Revenue hit $5 and costs $10.')).toBe(
      '<p>Revenue hit $5 and costs $10.</p>',
    );
  });

  it('parses and protects math only when asked', async () => {
    const output = await html('The derivative $f\'(x)$ is "steep."', { math: true });
    expect(output).toContain('<code class="language-math math-inline">f\'(x)</code>');
    expect(output).toContain('“steep.”');
    expect(await md('Say $x\'$ and "go."', { math: true })).toBe("Say $x'$ and “go.”");
  });

  it('drops raw HTML from HTML targets and keeps it in markdown', async () => {
    const source = '<div class="x">"Raw"</div>\n\nSay <b title="it\'s">"hi"</b>.';
    const output = await html(source, { hanging: false });
    expect(output).not.toContain('<div');
    expect(output).not.toContain('<b');
    expect(await md(source)).toBe('<div class="x">"Raw"</div>\n\nSay <b title="it\'s">“hi”</b>.');
  });
});

describe('markdown source splice', () => {
  const allowed = new Map([
    ['"', ['“', '”']],
    ["'", ['‘', '’']],
    [' ', [nbsp]],
  ]);
  it.each([
    ['code and math', '`it\'s` and $x\'$\n\n```\n"x"\n```\n\n$$\n"y"\n$$'],
    ['destinations', "[a](https://x.test/it's \"t\") ![b](i's.png) <https://x.test/'q'>"],
    ['autolink literal', "Visit https://x.test/it's and www.x.test/'q' now."],
    ['markers', '*"a"* _"b"_ **"c"** __"d"__\n\n- one "x"\n* two "y"\n1. three "z"'],
    ['wrapping', 'A "long\nwrapped" line\nthat\'s here.\n\n> Quote "one,\n> two" done.'],
    ['lazy list', '- "One" item\n  continues "here."'],
    ['footnote labels', 'Text[^it\'s].\n\n[^it\'s]: "Def."'],
    ['table delimiters', '| "a" |\n| :-: |\n| b |'],
  ])('changes only typographic characters (%s)', async (_, fixture) => {
    // Trailing prose proves the splice ran; everything before it must stay protected.
    const source = `${fixture}\n\nThen "ok."`;
    const output = await md(source, { math: true, spacing: { shortWords: true, lastWords: true } });
    expect(output.length).toBe(source.length);
    const unexpected = source
      .split('')
      .flatMap((char, i) =>
        output[i] !== char && !allowed.get(char)?.includes(output[i])
          ? [`${i}: ${char}→${output[i]}`]
          : [],
      );
    expect(unexpected).toEqual([]);
    expect(output).not.toBe(source);
  });

  it('keeps escaped quotes straight', async () => {
    expect(await md('Say \\"hello\\" and "bye."')).toBe('Say \\"hello\\" and “bye.”');
  });

  it('leaves entity quotes as written in markdown, while web curls them', async () => {
    const source = 'He said &quot;no&quot; and "yes."';
    expect(await md(source)).toBe('He said &quot;no&quot; and “yes.”');
    expect(await html(source)).toContain('“no”');
  });

  it('aligns through listed and numeric entities', async () => {
    expect(await md('A &amp; B &#38; C said "hi."')).toBe('A &amp; B &#38; C said “hi.”');
  });

  it('aborts only the node containing an unlisted named entity', async () => {
    expect(await md('Wait&hellip; "no."\n\nThen "yes."')).toBe('Wait&hellip; "no."\n\nThen “yes.”');
  });
});

describe('corpus', () => {
  // Quotes decoded from entities are the splice contract's deliberate misses.
  const entityQuotes: (typeof cases)[number][] = [
    { id: 'entity-quote', input: 'He said &quot;no&quot; and "yes."' },
  ];
  const fixtures = [...cases, ...entityQuotes];

  it('reaches reparse parity, except named entity-quote fixtures', async () => {
    const differ: string[] = [];
    for (const fixture of fixtures) {
      const options = { ...en, locale: fixture.locale ?? 'en' };
      const output = await md(fixture.input, options);
      if (visible(parse(output)) !== engine(fixture.input, options)) differ.push(fixture.id);
    }
    expect(differ).toEqual(entityQuotes.map((fixture) => fixture.id));
  });

  it('is idempotent', async () => {
    const changed: string[] = [];
    for (const fixture of cases) {
      const options = { ...en, locale: fixture.locale ?? 'en' };
      const once = await md(fixture.input, options);
      if ((await md(once, options)) !== once) changed.push(fixture.id);
    }
    expect(changed).toEqual([]);
  });
});

describe('peer loading', () => {
  const real: Peers = {
    unified: () => import('unified'),
    'remark-parse': () => import('remark-parse'),
    'remark-gfm': () => import('remark-gfm'),
    'remark-math': () => import('remark-math'),
    'remark-rehype': () => import('remark-rehype'),
    'rehype-stringify': () => import('rehype-stringify'),
    'rehype-parse': () => import('rehype-parse'),
  };
  const missing = (name: string, from = name) =>
    Object.assign(new Error(`Cannot find package '${from}' imported from /app/static.js`), {
      code: 'ERR_MODULE_NOT_FOUND',
    });
  const without = (...names: (keyof Peers)[]) => {
    const peers = { ...real };
    for (const name of names) peers[name] = () => Promise.reject(missing(name));
    return peers;
  };

  it('names every missing peer for the target', async () => {
    const run = createTypeset(without('remark-gfm', 'rehype-stringify'));
    await expect(run('x', { target: 'web' })).rejects.toThrow(
      '@calebduren/typograph/static needs these packages for target "web": remark-gfm, rehype-stringify.',
    );
  });

  it('propagates a missing transitive dependency and other errors unchanged', async () => {
    const transitive = missing('remark-gfm', 'micromark-extension-gfm');
    const other = new SyntaxError('broken');
    for (const error of [transitive, other]) {
      const run = createTypeset({ ...real, 'remark-gfm': () => Promise.reject(error) });
      await expect(run('x', { target: 'markdown' })).rejects.toBe(error);
    }
  });

  it('retries a peer that failed to load', async () => {
    let attempts = 0;
    const run = createTypeset({
      ...real,
      'remark-gfm': () =>
        ++attempts === 1 ? Promise.reject(missing('remark-gfm')) : real['remark-gfm'](),
    });
    await expect(run('"x"', { target: 'markdown', locale: 'en' })).rejects.toThrow(/remark-gfm/);
    await expect(run('"x"', { target: 'markdown', locale: 'en' })).resolves.toBe('“x”');
    await run('"x"', { target: 'markdown', locale: 'en' });
    expect(attempts).toBe(2);
  });

  it('loads only the peers a call needs', async () => {
    const run = createTypeset(without('remark-math', 'remark-rehype', 'rehype-stringify'));
    await expect(run('"x"', { target: 'markdown', locale: 'en' })).resolves.toBe('“x”');
    await expect(run('"x"', { target: 'markdown', locale: 'en', math: true })).rejects.toThrow(
      /: remark-math\./,
    );
  });
});

describe('options', () => {
  it('passes through without a locale but still renders', async () => {
    expect(await typeset('"Hi"', { target: 'web' })).toBe('<p>"Hi"</p>');
    expect(await typeset('"Hi" *there*', { target: 'markdown' })).toBe('"Hi" *there*');
  });

  it('turns hanging off for web and ignores it for email', async () => {
    expect(await html('"Hi"', { hanging: false })).toBe('<p>“Hi”</p>');
    expect(await typeset('"Hi"', { target: 'email', ...en, hanging: true })).toBe('<p>“Hi”</p>');
  });
});
