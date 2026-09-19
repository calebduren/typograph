import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import type { Root } from 'mdast';
import remarkChatTypography, {
  type ChatTypographyOptions,
} from '../packages/chat-typography/src/index';

interface Case {
  id: string;
  input: string;
  expected: string;
  locale?: string;
}
const cases = JSON.parse(
  readFileSync(new URL('../validation/cases.json', import.meta.url), 'utf8'),
) as Case[];

function render(input: string, options: ChatTypographyOptions) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkGfm)
    .use(remarkChatTypography, options);
  const source = processor.parse(input);
  const originalLinks: string[] = [];
  const originalHtml: string[] = [];
  const collect = (node: any, urls: string[], html: string[]) => {
    if (node.type === 'link') urls.push(node.url);
    if (node.type === 'html') html.push(node.value);
    for (const child of node.children ?? []) collect(child, urls, html);
  };
  collect(source, originalLinks, originalHtml);
  const tree = processor.runSync(source, input) as Root;
  const transformedLinks: string[] = [];
  const transformedHtml: string[] = [];
  collect(tree, transformedLinks, transformedHtml);
  const visible = (node: any): string => {
    if (['text', 'inlineCode', 'code', 'math', 'inlineMath'].includes(node.type)) return node.value;
    if (node.type === 'break') return '\n';
    return (node.children ?? []).map(visible).join(node.type === 'root' ? '\n\n' : '');
  };
  return {
    text: visible(tree),
    links: transformedLinks,
    html: transformedHtml,
    originalLinks,
    originalHtml,
    tree,
  };
}

describe('chat typography candidate', () => {
  it.each(cases)('$id', (fixture) => {
    const result = render(fixture.input, {
      locale: fixture.locale ?? 'en',
      phase: 'complete',
      spacing: true,
    });
    expect(result.text).toBe(fixture.expected);
    expect(result.links).toEqual(result.originalLinks);
    expect(result.html).toEqual(result.originalHtml);
  });

  it('does nothing without an explicit supported locale', () => {
    expect(render('"Hello"', {}).text).toBe('"Hello"');
    expect(render('"Bonjour"', { locale: 'fr' }).text).toBe('"Bonjour"');
  });

  it('keeps right-edge quotes and partial units stable while streaming', () => {
    expect(render('"', { locale: 'en' }).text).toBe('"');
    expect(render('"Hello', { locale: 'en' }).text).toBe('“Hello');
    expect(render("Give '", { locale: 'en' }).text).toBe("Give '");
    expect(render("Give 'em ", { locale: 'en' }).text).toBe('Give ’em');
    expect(render('It took 30 m', { locale: 'en' }).text).toBe('It took 30 m');
    expect(render('It took 30 million years.', { locale: 'en' }).text).toBe(
      'It took 30 million years.',
    );
    expect(render('Wait 30 min.', { locale: 'en', spacing: true }).text).toBe('Wait 30\u00a0min.');
  });

  it('never introduces the known wrong mark at any prefix of the risk phrases', () => {
    const options = { locale: 'en', spacing: true };
    for (const { source, forbidden, observed } of [
      {
        source: 'It took 30 million years.',
        forbidden: '30\u00a0m',
        observed: (value: string) => value,
      },
      { source: "Give 'em a chance.", forbidden: 'Give ‘', observed: (value: string) => value },
      { source: '"Hello," she said.', forbidden: '”', observed: (value: string) => value[0] ?? '' },
    ]) {
      for (let length = 1; length <= source.length; length++) {
        const result = render(source.slice(0, length), options).text;
        expect(observed(result)).not.toContain(forbidden);
      }
    }
  });

  it('holds unfinished inline code and link destinations intact', () => {
    expect(render('Say "hello". `const x = "hi"', { locale: 'en' }).text).toBe(
      'Say “hello”. `const x = "hi"',
    );
    expect(render('Read ["the guide"](https://example.com/it\'s', { locale: 'en' }).text).toContain(
      "https://example.com/it's",
    );
  });

  it.each(['\n\n', '\n \t\n', '\r\n\r\n'])(
    'limits unfinished code protection to its paragraph: %j',
    (separator) => {
      for (const phase of ['streaming', 'complete'] as const) {
        expect(
          render('Press the ` key.' + separator + '"Hello," she said.', { locale: 'en', phase })
            .text,
        ).toBe('Press the ` key.\n\n“Hello,” she said.');
        expect(
          render('Type ``` to start.' + separator + '"Hello," she said.', { locale: 'en', phase })
            .text,
        ).toBe('Type ``` to start.\n\n“Hello,” she said.');
      }
      expect(render('`a\nb` "After."', { locale: 'en' }).text).toBe('a\nb “After.”');
      expect(render('`a` `b` "After."', { locale: 'en' }).text).toBe('a b “After.”');
    },
  );

  it('closes quotes before a footnote without changing its content', () => {
    expect(render('Say "hi"[^1].\n\n[^1]: "Note" here.', { locale: 'en' }).text).toBe(
      'Say “hi”.\n\n“Note” here.',
    );
  });

  it.each([
    ["Back in the '90s, a 6' fence was normal.", "Back in the ’90s, a 6' fence was normal."],
    ["It's 'bout 12' wide.", "It’s ’bout 12' wide."],
    ["Wait 'til the 40' mark.", "Wait ’til the 40' mark."],
  ])('preserves a measurement after an elision: %s', (input, expected) => {
    for (const phase of ['streaming', 'complete'] as const) {
      expect(render(input, { locale: 'en', phase }).text).toBe(expected);
    }
  });

  it.each([
    [`"'Hi,' she said."`, '“‘Hi,’ she said.”'],
    [`'"Hi," she said.'`, '‘“Hi,” she said.’'],
    [`"'Tis the season"`, '“’Tis the season”'],
    [`'Round the corner.'`, '‘Round the corner.’'],
    [`'Round the reader's desk.'`, '‘Round the reader’s desk.’'],
    [`'Tis the season.'`, '‘Tis the season.’'],
    [`Give 'em the 'blue ones'.`, 'Give ’em the ‘blue ones’.'],
    ['`` a ` b `` "After."', 'a ` b “After.”'],
    ['`` a ` b `` "After." `unfinished "code', 'a ` b “After.” `unfinished "code'],
    ['`` ](literal `` "After."', '](literal “After.”'],
  ])('handles adjacent quotes and literal delimiters: %s', (input, expected) => {
    for (const phase of ['streaming', 'complete'] as const) {
      const result = render(input, { locale: 'en', phase });
      expect(result.text).toBe(expected);
      const once = JSON.stringify(result.tree);
      remarkChatTypography({ locale: 'en', phase })(result.tree, { value: input });
      expect(JSON.stringify(result.tree)).toBe(once);
    }
  });

  it('keeps quote and apostrophe switches independent in quoted elisions', () => {
    expect(
      render("'Round the reader's desk.'", {
        locale: 'en',
        punctuation: { quotes: false },
      }).text,
    ).toBe("'Round the reader’s desk.'");
    expect(
      render("'Round the reader's desk.'", {
        locale: 'en',
        punctuation: { apostrophes: false },
      }).text,
    ).toBe("‘Round the reader's desk.’");
  });

  it.each([
    [`'"`, `'"`],
    [`'"H`, '‘“H'],
    [`"'`, `“'`],
    [`"'H`, '“‘H'],
    [`'Round`, `'Round`],
    [`'Round the corner.`, '’Round the corner.'],
    [`'Round the corner.'`, '‘Round the corner.’'],
  ])('keeps a deliberate interpretation of the stream prefix: %s', (input, expected) => {
    expect(render(input, { locale: 'en' }).text).toBe(expected);
  });

  it('has switchable rule families and only applies paragraph endings after completion', () => {
    const sentence =
      'The design needs a careful review before we share the first version with the whole team.';
    const options: ChatTypographyOptions = { locale: 'en', spacing: { lastWords: true } };
    expect(render(sentence, options).text).toContain('whole team.');
    expect(render(sentence, { ...options, phase: 'complete' }).text).toContain('whole\u00a0team.');
    expect(render('Wait 30 min.', { locale: 'en', spacing: false }).text).toBe('Wait 30 min.');
    expect(render('"Hello"', { locale: 'en', punctuation: false }).text).toBe('"Hello"');
  });

  it('works in a table cell without touching code or a destination', () => {
    const source =
      '| Heading | Result |\n| --- | --- |\n| "Hello" | `30 min` and [Fig. 2](https://example.com/30-min) |';
    const result = render(source, { locale: 'en', phase: 'complete', spacing: true });
    expect(result.text).toContain('“Hello”');
    expect(result.text).toContain('30 min');
    expect(result.text).toContain('Fig.\u00a02');
    expect(result.links).toEqual(['https://example.com/30-min']);
  });

  it('is idempotent on a parsed reply', () => {
    const input =
      '"Hello," she said. Wait 30 **min**; read [the guide](https://example.com/it\'s).';
    const processor = unified()
      .use(remarkParse)
      .use(remarkChatTypography, { locale: 'en', phase: 'complete' });
    const tree = processor.parse(input);
    processor.runSync(tree, input);
    const once = JSON.stringify(tree);
    processor.runSync(tree, input);
    expect(JSON.stringify(tree)).toBe(once);
  });

  it('keeps spacing opt-in and accepts English language tags in the same house style', () => {
    for (const locale of ['en', 'en-US', 'EN-us', 'en-GB', 'en-AU']) {
      expect(render('"Wait 30 min."', { locale }).text).toBe('“Wait 30 min.”');
    }
    for (const locale of ['en_US', 'english', '', 'fr-CA']) {
      expect(render('"Wait 30 min."', { locale }).text).toBe('"Wait 30 min."');
    }
  });

  it.each([
    [{ quotes: false, apostrophes: true }, "She said 'it’s ready'. Give ’em the cats’ bowls."],
    [{ quotes: true, apostrophes: false }, "She said ‘it's ready’. Give 'em the cats' bowls."],
    [{ quotes: false, apostrophes: false }, "She said 'it's ready'. Give 'em the cats' bowls."],
  ])('switches single quotes and apostrophes independently: %j', (punctuation, expected) => {
    expect(
      render("She said 'it's ready'. Give 'em the cats' bowls.", { locale: 'en', punctuation })
        .text,
    ).toBe(expected);
  });

  it.each([
    ['"Read [the guide](https://example.com) today."', '“Read the guide today.”'],
    [
      '"Read [the guide][guide] today."\n\n[guide]: https://example.com',
      '“Read the guide today.”\n\n',
    ],
    ['"Keep `const x = "hi"` intact."', '“Keep const x = "hi" intact.”'],
    ["'Read [the guide](https://example.com) today.'", '‘Read the guide today.’'],
    ['"Read **the guide** today."', '“Read the guide today.”'],
    ['"[Read the guide](https://example.com)"', '“Read the guide”'],
    ["'[care](https://example.com)'", '‘care’'],
    ['"`x`"', '“x”'],
  ])(
    'keeps punctuation context across protected and linked inline content: %s',
    (input, expected) => {
      const result = render(input, { locale: 'en' });
      expect(result.text).toBe(expected);
      expect(result.links).toEqual(result.originalLinks);
    },
  );

  it('does not bind across a link boundary or change a visible URL', () => {
    const result = render(
      "Wait 30 [min](https://example.com). Visit <https://example.com/it's-here>.",
      { locale: 'en', spacing: true },
    );
    expect(result.text).toBe("Wait 30 min. Visit https://example.com/it's-here.");
    expect(result.links).toEqual(result.originalLinks);
  });

  it('lets applications preserve a subtree without losing surrounding quote context', () => {
    const result = render('"Keep **straight \'quotes\'** here."', {
      locale: 'en',
      skip: (node) => node.type === 'strong',
    });
    expect(result.text).toBe("“Keep straight 'quotes' here.”");
  });

  it('is idempotent for curly contractions nested inside single quotes', () => {
    const input = "'It's a good day.'";
    const first = render(input, { locale: 'en' }).text;
    expect(first).toBe('‘It’s a good day.’');
    expect(render(first, { locale: 'en' }).text).toBe(first);
  });

  it('skips optional spacing for a run with an unusually long token', () => {
    const input = '"Wait 30 min." ' + 'x'.repeat(64_000);
    const result = render(input, { locale: 'en', spacing: true });
    expect(result.text).toBe('“Wait 30 min.” ' + 'x'.repeat(64_000));
    expect(
      render('Wait 30 min. ' + 'x'.repeat(256), { locale: 'en', spacing: true }).text,
    ).toContain('30\u00a0min');
    expect(
      render('Wait 30 min. ' + 'x'.repeat(257), { locale: 'en', spacing: true }).text,
    ).toContain('30 min');
  });

  it('handles long words and deeply nested inline formatting without recursive traversal', () => {
    const text = { type: 'text' as const, value: '"' + 'a'.repeat(64_000) + '"' };
    let nested: any = text;
    for (let i = 0; i < 20_000; i++) nested = { type: 'emphasis', children: [nested] };
    const root: any = { type: 'root', children: [{ type: 'paragraph', children: [nested] }] };
    remarkChatTypography({ locale: 'en' })(root);
    expect(text.value).toBe('“' + 'a'.repeat(64_000) + '”');
  });
});
