import { prerenderToNodeStream } from 'react-dom/static';
import { loadPage } from './main';
import type { Route } from './head';

export { headHtml, heads, routes } from './head';

/** A route's markup, rendered the way the browser's first render will see it. Build only. */
export async function render(route: Route): Promise<string> {
  const errors: unknown[] = [];
  const { prelude } = await prerenderToNodeStream(await loadPage(route), {
    onError: (error) => void errors.push(error),
  });
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk));
  if (errors.length) throw new AggregateError(errors, `Prerendering ${route} failed`);
  return Buffer.concat(chunks).toString('utf8');
}
