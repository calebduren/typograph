import type { Root } from 'mdast';
import { protectionMask, visit, type TypographyOptions, type Node, type TextNode } from './engine';

export type { TypographyOptions } from './engine';

/** @deprecated Renamed to TypographyOptions in 1.0.0; this alias will be removed in 2.0.0. */
export type ChatTypographyOptions = TypographyOptions;

/** Remark plugin for presentation-only typography in a parsed Markdown reply. */
function remarkTypography(options: TypographyOptions = {}) {
  let english = false;
  try {
    english =
      options.locale != null && Intl.getCanonicalLocales(options.locale)[0]?.split('-')[0] === 'en';
  } catch {
    /* Invalid language tags pass through, just like unsupported ones. */
  }
  return (tree: Root, file?: { value: unknown }): void => {
    if (!english) return;
    const original = typeof file?.value === 'string' ? file.value : undefined;
    visit(
      tree as unknown as Node,
      options,
      original,
      original ? protectionMask(original) : undefined,
    );
  };
}

export default remarkTypography;
export { remarkTypography };

export type TypesetTextOptions = Pick<
  TypographyOptions,
  'locale' | 'phase' | 'punctuation' | 'spacing'
>;

/** Typeset a plain string (no Markdown syntax). Output length always equals input length. */
export function typesetText(text: string, options: TypesetTextOptions = {}): string {
  // Blank lines separate blocks, so quote state resets as it does between paragraphs.
  const parts = text.split(/(\r?\n[ \t]*\r?\n)/);
  const blocks = parts.map((value): TextNode => ({ type: 'text', value }));
  const root = {
    type: 'root',
    children: blocks
      .filter((_, i) => i % 2 === 0)
      .map((node) => ({ type: 'paragraph', children: [node] })),
  };
  remarkTypography({ phase: 'complete', ...options })(root as unknown as Root);
  return blocks.map((node) => node.value).join('');
}

export { rehypeTypography, type HtmlTypographyOptions } from './html';
