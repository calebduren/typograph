import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import {
  createTypeset,
  mathPluginRequired,
  type MarkdownTypesetOptions,
  type MathPlugin,
} from './static-core';

export type { MathPlugin, TypesetTarget } from './static-core';

export interface MarkdownOptions extends Omit<MarkdownTypesetOptions, 'input' | 'math'> {
  /**
   * The `remark-math` plugin, to parse `$…$` and `$$…$$` as math. Off by default: single
   * dollars are usually currency. Import it yourself so bundlers see it only when used.
   */
  math?: MathPlugin;
}

const entry = '@calebduren/typograph/markdown';

// Static imports, so a bundler resolves only the packages Markdown input needs.
const run = createTypeset(
  {
    unified: () => Promise.resolve({ unified }),
    'remark-parse': () => Promise.resolve({ default: remarkParse }),
    'remark-gfm': () => Promise.resolve({ default: remarkGfm }),
    'remark-rehype': () => Promise.resolve({ default: remarkRehype }),
    'rehype-stringify': () => Promise.resolve({ default: rehypeStringify }),
  },
  // Unreachable after the checks below; kept so a future path cannot load a peer dynamically.
  () => Promise.reject(mathPluginRequired(entry)),
);

/** Typeset finished Markdown for the web, email, or back into Markdown. */
export async function typeset(markdown: string, options: MarkdownOptions): Promise<string> {
  const input = (options as { input?: unknown } | undefined)?.input;
  if (input === 'html') {
    throw new TypeError(
      `typeset() from ${entry} takes Markdown. For HTML input, import typeset from @calebduren/typograph/html.`,
    );
  }
  if (input != null && input !== 'markdown') {
    throw new TypeError(`typeset() from ${entry} takes Markdown input only.`);
  }
  if (options?.math && typeof options.math !== 'function') throw mathPluginRequired(entry);
  return run(markdown, { ...options, input: 'markdown' });
}
