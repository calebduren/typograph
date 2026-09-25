import type { Element, Nodes, Root, RootContent } from 'hast';
import { typesetSegments, type ChatTypographyOptions, type Segment } from './engine';
import { transparent } from './html-elements';
import { inherit, type State } from './html-scope';

export interface HtmlTypographyOptions extends Omit<ChatTypographyOptions, 'skip'> {
  /** Leave an application-selected HTML element and its descendants unchanged. */
  skip?: (node: Readonly<Nodes>) => boolean;
}

// Content that is never prose, even when it contains text nodes.
const nonProse = new Set([
  'code',
  'kbd',
  'samp',
  'var',
  'pre',
  'script',
  'style',
  'textarea',
  'template',
  'svg',
  'math',
  'head',
  'title',
  'noscript',
  'rt',
  'rp',
]);
const literalInline = new Set([
  'img',
  'input',
  'button',
  'select',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
  'canvas',
]);
const inlineDisplay = new Set(['inline', 'inline-block', 'contents']);

/** Only the inline style attribute is visible here; stylesheets and classes are not. */
function styledAsBlock(element: Element): boolean {
  const style = element.properties?.style;
  if (typeof style !== 'string') return false;
  const display = /(?:^|;)\s*display\s*:\s*([a-z-]+)/i.exec(style)?.[1]?.toLowerCase();
  return display != null && !inlineDisplay.has(display);
}

function hardStop(element: Element, options: HtmlTypographyOptions): boolean {
  return element.properties?.dataTypograph === 'off' || options.skip?.(element) === true;
}

/** Walk one block container; nested blocks are queued so traversal never recurses. */
function typesetHtml(tree: Root, options: HtmlTypographyOptions): void {
  const settings: ChatTypographyOptions = { ...options, skip: undefined };
  // HTML carries no source-syntax escapes, and right-edge decisions stay conservative.
  const hooks = { boundary: () => false };
  const blocks: [Root | Element, State][] = [[tree, { english: true, translate: true }]];
  while (blocks.length) {
    const [container, containerState] = blocks.pop()!;
    let segments: Segment[] = [];
    const emit = () => {
      if (segments.some((segment) => segment.kind === 'text')) {
        typesetSegments(segments, settings, hooks);
      }
      segments = [];
    };
    type Item = { node: RootContent; state: State } | null;
    const stack: Item[] = [];
    const pushChildren = (parent: Root | Element, state: State) => {
      for (let i = parent.children.length - 1; i >= 0; i--) {
        stack.push({ node: parent.children[i], state });
      }
    };
    pushChildren(container, containerState);
    while (stack.length) {
      const item = stack.pop()!;
      if (item === null) {
        segments.push({ kind: 'boundary' });
        continue;
      }
      const { node, state } = item;
      if (node.type === 'text') {
        segments.push(
          state.english && state.translate
            ? { kind: 'text', node }
            : { kind: 'literal', value: '\ufffc' },
        );
        continue;
      }
      // Comments (including conditional comments) and doctypes are never prose.
      if (node.type !== 'element') continue;
      if (hardStop(node, options) || nonProse.has(node.tagName)) {
        segments.push({ kind: 'literal', value: '\ufffc' });
      } else if (node.tagName === 'br') {
        segments.push({ kind: 'literal', value: '\n' });
      } else if (node.tagName === 'wbr') {
        segments.push({ kind: 'literal', value: '' });
      } else if (literalInline.has(node.tagName)) {
        segments.push({ kind: 'literal', value: '\ufffc' });
      } else if (node.tagName === 'a') {
        // Links end a spacing run on both sides while punctuation context continues.
        segments.push({ kind: 'boundary' });
        stack.push(null);
        pushChildren(node, inherit(node, state));
      } else if (transparent.has(node.tagName) && !styledAsBlock(node)) {
        pushChildren(node, inherit(node, state));
      } else {
        // Every other element, including unknown and custom ones, is a block.
        emit();
        blocks.push([node, inherit(node, state)]);
      }
    }
    emit();
  }
}

/** Rehype plugin for English typography in HTML text nodes. Attributes and markup are untouched. */
export function rehypeTypography(options: HtmlTypographyOptions = {}) {
  let english = false;
  try {
    english =
      options.locale != null && Intl.getCanonicalLocales(options.locale)[0]?.split('-')[0] === 'en';
  } catch {
    /* Invalid language tags pass through, just like unsupported ones. */
  }
  return (tree: Root): void => {
    if (english) typesetHtml(tree, options);
  };
}
