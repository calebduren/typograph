import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Streamdown, defaultRemarkPlugins } from 'streamdown';
import { expect, it } from 'vitest';
import remarkChatTypography from '../packages/chat-typography/src/index';
import hanging from '../packages/chat-typography/src/hanging';
import { remarkPreview, previewRehypePlugins } from '../apps/playground/src/chat-preview';

it('renders polished assistant prose through Streamdown without changing code', () => {
  const html = renderToStaticMarkup(
    <Streamdown
      mode="static"
      controls={false}
      remarkPlugins={[
        ...Object.values(defaultRemarkPlugins),
        [remarkChatTypography, { locale: 'en', phase: 'complete', spacing: true }],
      ]}
    >
      {'"Hello," she said. Wait 30 **min** and keep `const x = "hi"`.'}
    </Streamdown>,
  );
  expect(html).toContain('“Hello,”');
  expect(html).toMatch(/30\u00a0<[^>]+>min<\//);
  expect(html).toContain('const x = &quot;hi&quot;');
  expect(html).not.toContain('const x = “hi”');
});

it('keeps hanging markup after Streamdown sanitization, including highlighted quotes', () => {
  const html = renderToStaticMarkup(
    <Streamdown
      mode="static"
      controls={false}
      allowedTags={{ mark: [] }}
      remarkPlugins={[
        ...Object.values(defaultRemarkPlugins),
        [remarkPreview, { punctuation: true, spacing: false, highlight: true }],
      ]}
      rehypePlugins={[...previewRehypePlugins, [hanging, { locale: 'en' }]]}
    >
      {'"Read **this**."\n\n\\"Escaped opening and it\'s unchanged."\n\n`"literal"`'}
    </Streamdown>,
  );
  expect(html).toContain('class="typograph-opening"');
  expect(html.match(/class="typograph-opening"/g)).toHaveLength(1);
  expect(html).toContain('data-typograph-hanging=""');
  expect(html).toContain(
    '<mark data-typograph-change="punctuation"><span class="typograph-opening"><span>“</span></span></mark>',
  );
  expect(html).toContain('&quot;literal&quot;');
});
