import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import { createTypeset, type HtmlTypesetOptions } from './static-core';

export interface HtmlOptions extends Omit<HtmlTypesetOptions, 'input'> {
  /** Ignored. Accepted so options written for `@calebduren/typograph/static` work unchanged. */
  input?: 'html';
}

const entry = '@calebduren/typograph/html';
const unsupported = () =>
  new TypeError(
    `typeset() from ${entry} takes HTML. For Markdown input, import typeset from @calebduren/typograph/markdown.`,
  );

// Static imports, so a bundler resolves only the packages HTML input needs.
const run = createTypeset(
  {
    unified: () => Promise.resolve({ unified }),
    'rehype-parse': () => Promise.resolve({ default: rehypeParse }),
  },
  () => Promise.reject(unsupported()),
);

/** Typeset trusted HTML, changing only typographic characters. */
export async function typeset(html: string, options: HtmlOptions): Promise<string> {
  const input = (options as { input?: unknown } | undefined)?.input;
  if (input != null && input !== 'html') throw unsupported();
  return run(html, { ...options, input: 'html' });
}
