import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { rehypeTypography } from '../packages/chat-typography/src/index';
import rehypeHangingPunctuation from '../packages/chat-typography/src/hanging';
import { consumedLength } from '../packages/chat-typography/src/html-splice';
import { typeset } from '../packages/chat-typography/src/static';
import { createTypeset, type Peers } from '../packages/chat-typography/src/static-core';

const cases = JSON.parse(
  readFileSync(new URL('../validation/cases.json', import.meta.url), 'utf8'),
) as { id: string; input: string; locale?: string }[];
const nbsp = '\u00a0';
const en = { input: 'html', target: 'web', locale: 'en', spacing: true } as const;
const html = (source: string, options: object = {}) => typeset(source, { ...en, ...options });
const decoder = unified().use(rehypeParse, { fragment: true });
const decode = (value: string) =>
  (decoder.parse(value).children as { value?: string }[])
    .map((child) => child.value ?? '')
    .join('');

/** Every changed span must turn a quote, apostrophe, space, or quote reference into typography. */
function editsOnlyTypography(source: string, output: string): string[] {
  const problems: string[] = [];
  let i = 0;
  let j = 0;
  while (i < source.length || j < output.length) {
    if (source[i] === output[j]) {
      i++;
      j++;
      continue;
    }
    const reference = /^&[#A-Za-z0-9]+;/.exec(source.slice(i))?.[0];
    const from = reference && /["']/.test(decode(reference)) ? reference : source[i];
    const ok =
      (/["']/.test(from.length === 1 ? from : decode(from)) && /[“”‘’]/.test(output[j])) ||
      (from === ' ' && output[j] === nbsp);
    if (!ok) problems.push(`${i}: ${JSON.stringify(from)} → ${JSON.stringify(output[j])}`);
    i += from.length;
    j++;
  }
  return problems;
}

const template = [
  '<!DOCTYPE html>',
  '<html lang="en"><head><title>Bob\'s "brief"</title><style>p{font-family:"Georgia"}</style></head>',
  '<body><table role="presentation"><tr><td style="font-family:\'Georgia\'">',
  '  <h1>"Morning," Bob</h1>',
  '  <p>It\'s 30 min to J. R. R. Tolkien\'s office &amp; the "annex."<br>Next &quot;line&quot; &#39;quoted&#x27;.</p>',
  '  <p>Run <code>it\'s</code> and <a href="https://x.test/it\'s" title="it\'s">the "guide"</a>.</p>',
  '  <!--[if mso]><p>"Outlook"</p><![endif]-->',
  '  <p lang="fr">"Bonjour"</p><p data-typograph="off">"Keep"</p>',
  '  <p><b>"Bold</b> quote" spans.</p>',
  '</td></tr></table></body></html>',
].join('\r\n');

describe('typeset({ input: "html" })', () => {
  it('edits only typography in an email template', async () => {
    const output = await html(template, { html: 'document', target: 'email' });
    expect(editsOnlyTypography(template, output)).toEqual([]);
    expect(output).toBe(
      template
        .replace('<h1>"Morning," Bob', '<h1>“Morning,” Bob')
        .replace(
          'It\'s 30 min to J. R. R. Tolkien\'s office &amp; the "annex."<br>Next &quot;line&quot; &#39;quoted&#x27;.',
          `It’s 30${nbsp}min to J.${nbsp}R.${nbsp}R. Tolkien’s office &amp; the “annex.”<br>Next “line” ‘quoted’.`,
        )
        .replace('the "guide"</a>', 'the “guide”</a>')
        .replace('<b>"Bold</b> quote" spans.', '<b>“Bold</b> quote” spans.'),
    );
    expect(await html(template, { html: 'document', target: 'web' })).toBe(output);
  });

  it('replaces quote references whole and leaves other references alone', async () => {
    expect(await html('<p>&quot;A&quot; &#34;B&#34; &#39;C&#x27; D&#39;s</p>')).toBe(
      '<p>“A” “B” ‘C’ D’s</p>',
    );
    expect(await html('<p>Say &amp;quot;raw&amp;quot; &mdash; "ok."</p>')).toBe(
      '<p>Say &amp;quot;raw&amp;quot; &mdash; “ok.”</p>',
    );
    expect(await html('<p>"A" <a href="#">&quot;B&quot;</a> <code>&quot;C&quot;</code></p>')).toBe(
      '<p>“A” <a href="#">“B”</a> <code>&quot;C&quot;</code></p>',
    );
  });

  it('aborts only nodes whose references cannot be proven', async () => {
    expect(await html('<p>Bad &#0; "quote"</p><p>"Fine"</p>')).toBe(
      '<p>Bad &#0; "quote"</p><p>“Fine”</p>',
    );
  });

  it('consumes references exactly as the parser does', () => {
    const rows: [string, number | 'literal' | 'abort'][] = [
      ['&quot;', 6],
      ['&#34;', 5],
      ['&#39;', 5],
      ['&#x27;', 6],
      ['&amp;', 5],
      ['&notin;', 7],
      ['&notit;', 4],
      ['&ampamp;', 4],
      ['&#39x', 4],
      ['&copyright', 5],
      ['&#128512;', 9],
      ['&NotEqualTilde;', 15],
      ['&nosuch;', 'literal'],
      ['&', 'literal'],
      ['&#;', 'literal'],
    ];
    expect(rows.map(([token]) => [token, consumedLength(token, decode)])).toEqual(rows);
  });

  it('never edits text whose source range is not provably its own', async () => {
    const foster = '<table>"before"<tr><td>"cell"</td></tr>"after"</table>';
    expect(await html(foster)).toBe(foster);
    const misplaced = '<p>"One"</p><body><p>"Two"</p></body><html>"Three"';
    expect(editsOnlyTypography(misplaced, await html(misplaced))).toEqual([]);
    expect(editsOnlyTypography(misplaced, await html(misplaced, { html: 'document' }))).toEqual([]);
  });

  it('handles CRLF and lone CR line endings', async () => {
    expect(await html('<p>"One\r\ntwo" and\rit\'s</p>')).toBe('<p>“One\r\ntwo” and\rit’s</p>');
  });
});

describe('HTML content policy', () => {
  it.each([
    [
      'non-prose subtrees',
      '<p>"a" <kbd>"b"</kbd> <samp>"c"</samp> <var>"d"</var></p>',
      '<p>“a” <kbd>"b"</kbd> <samp>"c"</samp> <var>"d"</var></p>',
    ],
    [
      'pre and scripts',
      '<pre>"a"</pre><script>var a = "b";</script><p>"c"</p>',
      '<pre>"a"</pre><script>var a = "b";</script><p>“c”</p>',
    ],
    [
      'ruby annotations',
      '<p>"<ruby>漢<rt>"kan"</rt></ruby>"</p>',
      '<p>“<ruby>漢<rt>"kan"</rt></ruby>”</p>',
    ],
    ['literal inline', '<p>"a <img alt="it\'s"> b"</p>', '<p>“a <img alt="it\'s"> b”</p>'],
    ['line breaks', '<p>"a<br>b"</p>', '<p>“a<br>b”</p>'],
    [
      'text in cells beside blocks',
      '<td>"Cell," she said.<p>"Para."</p>"After."</td>',
      '<td>“Cell,” she said.<p>“Para.”</p>“After.”</td>',
    ],
    [
      'links bound spacing',
      '<p>Wait 30 <a href="#">min</a> and J. R. <b>R.</b></p>',
      `<p>Wait 30 <a href="#">min</a> and J.${nbsp}R.${nbsp}<b>R.</b></p>`,
    ],
    [
      'display:none is its own block',
      '<span style="display:none">"Preheader" text</span>',
      '<span style="display:none">“Preheader” text</span>',
    ],
  ])('%s', async (_, source, expected) => {
    expect(await html(source)).toBe(expected);
  });

  it('inherits lang and translate with nested overrides', async () => {
    expect(await html('<p lang="fr">"Bonjour" <span lang="en-GB">"Hello"</span></p>')).toBe(
      '<p lang="fr">"Bonjour" <span lang="en-GB">“Hello”</span></p>',
    );
    expect(await html('<div lang="en"><p lang="fr">"Non" <b lang="en">"Yes"</b></p></div>')).toBe(
      '<div lang="en"><p lang="fr">"Non" <b lang="en">“Yes”</b></p></div>',
    );
    expect(await html('<p translate="no">"Keep" <span translate="yes">"Go"</span></p>')).toBe(
      '<p translate="no">"Keep" <span translate="yes">“Go”</span></p>',
    );
    expect(await html('<p lang="">"Unknown"</p>')).toBe('<p lang="">"Unknown"</p>');
  });

  it('treats data-typograph="off" and skip as hard stops', async () => {
    expect(await html('<p data-typograph="off">"Off" <span lang="en">"Still"</span></p>')).toBe(
      '<p data-typograph="off">"Off" <span lang="en">"Still"</span></p>',
    );
    const skip = (node: { type: string; tagName?: string }) => node.tagName === 'aside';
    expect(await html('<aside>"a"</aside><p>"b"</p>', { skip })).toBe(
      '<aside>"a"</aside><p>“b”</p>',
    );
  });

  it('pins quotes across styled and custom block boundaries', async () => {
    // Conservative fallbacks: a boundary resets quote state. Review any change here.
    expect(await html('<p>"A <span style="display:block">B"</span> C"</p>')).toBe(
      '<p>“A <span style="display:block">B"</span> C"</p>',
    );
    expect(await html('<p>"Start <x-card>middle</x-card> end."</p>')).toBe(
      '<p>“Start <x-card>middle</x-card> end."</p>',
    );
  });

  it('typesets attribute-like prose like any other prose', async () => {
    // Same result as typesetText: the engine leaves a quote after '=' straight.
    expect(await html('<p>Write title="it\'s" here.</p>')).toBe('<p>Write title="it’s" here.</p>');
  });
});

describe('HTML corpus', () => {
  const rendered = (input: string) =>
    String(
      unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeStringify)
        .processSync(input),
    );
  const text = (node: { value?: string; children?: unknown[] }): string =>
    node.value ?? (node.children ?? []).map((child) => text(child as typeof node)).join('');
  const marks = (value: string) =>
    [...text(decoder.parse(value))].filter((c) => /[“”‘’\u00a0]/.test(c)).join('');

  it('matches the Markdown engine except the pinned escape cases', async () => {
    const differ: string[] = [];
    for (const fixture of cases) {
      const options = { locale: fixture.locale ?? 'en', spacing: true } as const;
      const fromMarkdown = await typeset(fixture.input, {
        ...options,
        target: 'web',
        hanging: false,
      });
      const fromHtml = await typeset(rendered(fixture.input), {
        ...options,
        input: 'html',
        target: 'web',
      });
      if (marks(fromMarkdown) !== marks(fromHtml)) differ.push(fixture.id);
    }
    // HTML has no backslash escapes, so those quotes curl. remark-rehype drops raw HTML,
    // so a custom element's content reaches the HTML side as bare prose. Changing this
    // list needs review.
    expect(differ.sort()).toEqual([
      'custom-element-citation',
      'custom-element-content',
      'escaped-after-entity',
      'escaped-quote',
    ]);
  });

  it('is idempotent', async () => {
    const changed: string[] = [];
    for (const fixture of cases) {
      const options = { ...en, locale: fixture.locale ?? 'en' };
      const once = await typeset(rendered(fixture.input), options);
      if ((await typeset(once, options)) !== once) changed.push(fixture.id);
    }
    expect(changed).toEqual([]);
  });
});

describe('rehypeTypography', () => {
  it('runs in a rehype pipeline with HTML-source hanging', async () => {
    const output = String(
      await unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeTypography, { locale: 'en', phase: 'complete' })
        .use(rehypeHangingPunctuation, { locale: 'en', source: 'html' })
        .use(rehypeStringify)
        .process('<p>"Hi," it\'s me.</p><p lang="fr">"Salut"</p><ul><li><p>"Item"</p></li></ul>'),
    );
    expect(output).toBe(
      '<p data-typograph-hanging=""><span class="typograph-opening"><span>“</span></span>Hi,” it’s me.</p><p lang="fr">"Salut"</p><ul><li><p>“Item”</p></li></ul>',
    );
  });

  it('keeps the Markdown default for hanging', async () => {
    const run = (source?: 'html') =>
      String(
        unified()
          .use(rehypeParse, { fragment: true })
          .use(rehypeHangingPunctuation, { locale: 'en', source })
          .use(rehypeStringify)
          .processSync('<p>“Hi”</p>'),
      );
    // Parsed HTML starts with '<' at every element offset, so Markdown mode treats it as raw HTML.
    expect(run()).toBe('<p>“Hi”</p>');
    expect(run('html')).toContain('typograph-opening');
  });

  it('passes through without an English locale', () => {
    const tree = unified().use(rehypeParse, { fragment: true }).parse('<p>"Hi"</p>');
    rehypeTypography({ locale: 'fr' })(tree);
    expect((tree.children[0] as { children: { value: string }[] }).children[0].value).toBe('"Hi"');
  });
});

describe('HTML input errors', () => {
  it('rejects Markdown-only options', async () => {
    await expect(typeset('<p>x</p>', { ...en, target: 'markdown' } as never)).rejects.toThrow(
      TypeError,
    );
    await expect(typeset('<p>x</p>', { ...en, math: true } as never)).rejects.toThrow(/math/);
    await expect(typeset('<p>x</p>', { ...en, hanging: true } as never)).rejects.toThrow(
      /rehypeTypography/,
    );
    await expect(typeset('<p>"x"</p>', { ...en, hanging: false })).resolves.toBe('<p>“x”</p>');
    await expect(typeset('<p>x</p>', { ...en, html: 'xml' } as never)).rejects.toThrow(/fragment/);
  });

  it('passes HTML through without an English locale', async () => {
    const source = '<p>"Bonjour"</p>';
    expect(await typeset(source, { input: 'html', target: 'web', locale: 'fr' })).toBe(source);
    expect(await typeset(source, { input: 'html', target: 'web' })).toBe(source);
  });

  it('names a missing rehype-parse', async () => {
    const peers = {
      unified: () => import('unified'),
      'rehype-parse': () =>
        Promise.reject(
          Object.assign(new Error("Cannot find package 'rehype-parse' imported from /app/x.js"), {
            code: 'ERR_MODULE_NOT_FOUND',
          }),
        ),
    } as unknown as Peers;
    await expect(createTypeset(peers)('<p>x</p>', en)).rejects.toThrow(/: rehype-parse\./);
  });
});
