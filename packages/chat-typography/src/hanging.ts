import type { Root, Nodes, Parent, Element } from 'hast';
import { elisions } from './quote-context';

export interface HangingPunctuationOptions {
  /** Only known English, left-to-right prose is supported. */
  locale?: string;
  /** Leave an application-selected subtree unchanged. */
  skip?: (node: Readonly<Nodes>) => boolean;
}

const containers = new Set(['div', 'section', 'article', 'blockquote']);
const blocks = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const inline = new Set(['em', 'strong', 'del', 'a', 'mark']);

/** Opt-in opening-quote layout. Pair with @calebduren/typograph/hanging.css. */
export default function rehypeHangingPunctuation(options: HangingPunctuationOptions = {}) {
  let english = false;
  try {
    english =
      options.locale != null && Intl.getCanonicalLocales(options.locale)[0]?.split('-')[0] === 'en';
  } catch {
    /* Pass through unknown locales. */
  }
  return (tree: Root, file?: { value?: unknown }) => {
    if (!english) return;
    const source = typeof file?.value === 'string' ? file.value : undefined;
    const skip = (node: Nodes) =>
      options.skip?.(node) ||
      (node.type === 'element' &&
        node.position?.start.offset != null &&
        source?.[node.position.start.offset] === '<');
    const stack: Nodes[] = [tree];
    while (stack.length) {
      const node = stack.pop()!;
      if (skip(node)) continue;
      if (node.type === 'root' || (node.type === 'element' && containers.has(node.tagName))) {
        // Skip whole lists, including nested paragraphs, to keep quotes clear of markers.
        // Also leave code, raw HTML, tables, math, and unknown custom elements alone.
        for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
      }
      if (node.type === 'element' && blocks.has(node.tagName)) {
        let parent: Parent = node;
        let first = parent.children[0];
        while (first?.type === 'element' && inline.has(first.tagName) && !skip(first)) {
          parent = first;
          first = parent.children[0];
        }
        if (
          !first ||
          first.type !== 'text' ||
          options.skip?.(first) ||
          !/^["'“‘]/.test(first.value)
        )
          continue;
        if (first.value[0] === "'") {
          const token = /^[\p{L}\p{M}\p{N}]*/u.exec(first.value.slice(1, 8))![0].toLowerCase();
          // Without punctuation conversion, a leading apostrophe can be an elision.
          if (/^\d{0,2}s?$/i.test(token) || elisions.some((value) => value.startsWith(token)))
            continue;
        }
        const offset = first.position?.start.offset;
        if (source != null && offset != null && source[offset] === '\\') continue;
        const quote: Element = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['typograph-opening'] },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: {},
              children: [{ type: 'text', value: first.value[0] }],
            },
          ],
        };
        first.value = first.value.slice(1);
        parent.children.splice(0, 1, quote, ...(first.value ? [first] : []));
        (node.properties ??= {})['data-typograph-hanging'] = '';
      }
    }
  };
}
