import { createTypeset } from './static-core';

export type {
  HtmlTypesetOptions,
  MarkdownTypesetOptions,
  TypesetOptions,
  TypesetTarget,
} from './static-core';

// Literal specifiers so bundlers can resolve them; loaded only when typeset() runs,
// because each peer is optional and may be absent.
export const typeset = createTypeset({
  unified: () => import('unified'),
  'remark-parse': () => import('remark-parse'),
  'remark-gfm': () => import('remark-gfm'),
  'remark-math': () => import('remark-math'),
  'remark-rehype': () => import('remark-rehype'),
  'rehype-stringify': () => import('rehype-stringify'),
  'rehype-parse': () => import('rehype-parse'),
});
