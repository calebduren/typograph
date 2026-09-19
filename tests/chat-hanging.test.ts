import { describe, expect, it } from 'vitest';
import type { Element, Root, RootContent } from 'hast';
import hanging from '../packages/chat-typography/src/hanging';

const element = (tagName: string, children: Element['children']): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});
const text = (value: string): { type: 'text'; value: string } => ({ type: 'text', value });
const root = (...children: RootContent[]): Root => ({ type: 'root', children });
const content = (node: Root | RootContent): string =>
  'value' in node ? node.value : 'children' in node ? node.children.map(content).join('') : '';

describe('optional hanging punctuation', () => {
  it('decorates a hand-built element with no properties', () => {
    const paragraph = {
      type: 'element',
      tagName: 'p',
      children: [text('"Hi" there')],
    } as Element;
    const tree = root(paragraph);
    const transform = hanging({ locale: 'en' });
    transform(tree);
    expect(paragraph.properties).toEqual({ 'data-typograph-hanging': '' });
    expect(content(tree)).toBe('"Hi" there');
    const once = JSON.stringify(tree);
    transform(tree);
    expect(JSON.stringify(tree)).toBe(once);
  });

  it('supports tight, loose, and nested list items without wrapping twice', () => {
    const tree = root(
      element('ul', [
        element('li', [text('“Tight.”'), element('ul', [element('li', [text('“Nested.”')])])]),
        element('li', [text('\n'), element('p', [text('“Loose.”')])]),
        element('li', [element('em', [text('“Emphasized.”')])]),
      ]),
    );
    const before = content(tree);
    const transform = hanging({ locale: 'en' });
    transform(tree);
    expect(content(tree)).toBe(before);
    expect(JSON.stringify(tree).match(/typograph-opening/g)).toHaveLength(4);
    const once = JSON.stringify(tree);
    transform(tree);
    expect(JSON.stringify(tree)).toBe(once);
  });

  it.each(["'em all", "'Tis the season", "'Round the corner", "'90s", "'t", "'"])(
    'does not hang an ambiguous straight apostrophe: %s',
    (value) => {
      const tree = root(element('p', [text(value)]));
      hanging({ locale: 'en' })(tree);
      expect(content(tree)).toBe(value);
      expect(JSON.stringify(tree)).not.toContain('typograph-opening');
    },
  );

  it('wraps the opening quote once and preserves every text character and link destination', () => {
    const link = element('a', [text('“Read this.”')]);
    link.properties.href = "https://example.com/it's";
    const tree = root(
      element('h2', [element('strong', [link])]),
      element('p', [text('"Quoted prose."')]),
    );
    const before = content(tree);
    const transform = hanging({ locale: 'en-US' });
    transform(tree);
    expect(content(tree)).toBe(before);
    expect(link.properties.href).toBe("https://example.com/it's");
    expect(JSON.stringify(tree).match(/typograph-opening/g)).toHaveLength(2);
    const once = JSON.stringify(tree);
    transform(tree);
    expect(JSON.stringify(tree)).toBe(once);
  });

  it('does not enter code, math, tables, raw HTML, or app-skipped subtrees', () => {
    const tree = root(
      element('pre', [element('code', [text('"code"')])]),
      element('math', [text('"math"')]),
      element('table', [element('p', [text('"table"')])]),
      element('p', [element('code', [text('"inline code"')])]),
      element('aside', [element('p', [text('"custom"')])]),
      element('blockquote', [element('p', [text('"skip"')])]),
    );
    const before = JSON.stringify(tree);
    hanging({
      locale: 'en',
      skip: (node) => node.type === 'element' && node.tagName === 'blockquote',
    })(tree);
    expect(JSON.stringify(tree)).toBe(before);
    const html = element('p', [text('"HTML"')]);
    html.position = {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 14, offset: 13 },
    };
    const raw = root(html);
    hanging({ locale: 'en' })(raw, { value: '<p>"HTML"</p>' });
    expect(html.properties).toEqual({});
  });

  it('leaves escaped quotes, leading literals, and unknown languages alone', () => {
    const escaped = {
      ...text('"Keep this."'),
      position: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 14, offset: 13 },
      },
    };
    const tree = root(element('p', [escaped]));
    hanging({ locale: 'en' })(tree, { value: '\\"Keep this."' });
    expect(JSON.stringify(tree)).not.toContain('typograph-opening');
    for (const locale of [undefined, 'fr', 'not_a_locale']) {
      const other = root(element('p', [text('"Unchanged."')]));
      hanging({ locale })(other);
      expect(JSON.stringify(other)).not.toContain('typograph-opening');
    }
    const plain = root(element('p', [text('No opening quote. “Quoted later.”')]));
    hanging({ locale: 'en' })(plain);
    expect(JSON.stringify(plain)).not.toContain('typograph-opening');
  });
});
