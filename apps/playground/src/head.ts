/** The prerendered routes, by pathname. */
export const routes = ['/', '/changelog', '/specimen', '/integration'] as const;
export type Route = (typeof routes)[number];

export type Head = {
  title: string;
  description: string;
  canonical: string;
  /** Adds `<meta name="robots" content="noindex">`. */
  noindex?: boolean;
  /** Adds `<link rel="alternate">` for another format of the same page. */
  alternate?: { type: string; href: string };
};

const origin = 'https://typograph.dev';

/** Each route's own title, description, and canonical URL. Open Graph mirrors them. */
export const heads: Record<Route, Head> = {
  '/': {
    title: 'Typograph — Better typography for AI-generated text',
    description:
      'Careful English typography for AI-generated text. A small Remark plugin for streaming chat, plus typeset() for finished Markdown, HTML, and plain strings.',
    canonical: `${origin}/`,
  },
  '/changelog': {
    title: 'Changelog — Typograph',
    description:
      'Release notes for @calebduren/typograph: every change to rendered output, listed by version.',
    canonical: `${origin}/changelog`,
  },
  '/integration': {
    title: 'Integrate Typograph: AI Elements, Streamdown, Cloudflare',
    description:
      'Add Typograph to AI Elements, shadcn, Streamdown, Cloudflare Agents, or any Remark renderer, with streaming setup, hanging punctuation, and known limits.',
    canonical: `${origin}/integration`,
    alternate: { type: 'text/markdown', href: '/integration.md' },
  },
  '/specimen': {
    title: 'Specimen — Typograph',
    description:
      'A typography specimen: Streamdown output set through the Typograph Remark plugin.',
    canonical: `${origin}/specimen`,
    noindex: true,
  },
};

/** The route for a pathname; unknown paths render the landing page. */
export function routeOf(pathname: string): Route {
  const path = pathname.replace(/\/(index)?(\.html)?$/, '').replace(/\.html$/, '') || '/';
  return (routes as readonly string[]).includes(path) ? (path as Route) : '/';
}

/**
 * Brings the document head in line with a route. The build writes the same tags into each
 * prerendered page, so on a served page this changes nothing; the dev server's single
 * index.html relies on it.
 */
export function applyHead(head: Head) {
  document.title = head.title;
  const upsert = (selector: string, create: () => HTMLElement) =>
    document.head.querySelector<HTMLElement>(selector) ?? document.head.appendChild(create());
  const meta = (key: 'name' | 'property', name: string, content: string | undefined) => {
    const selector = `meta[${key}="${name}"]`;
    if (content === undefined) return document.head.querySelector(selector)?.remove();
    upsert(selector, () => {
      const element = document.createElement('meta');
      element.setAttribute(key, name);
      return element;
    }).setAttribute('content', content);
  };
  const link = (rel: string, attributes: Record<string, string> | undefined) => {
    const selector = `link[rel="${rel}"]`;
    if (!attributes) return document.head.querySelector(selector)?.remove();
    const element = upsert(selector, () => {
      const created = document.createElement('link');
      created.rel = rel;
      return created;
    });
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  };
  meta('name', 'description', head.description);
  meta('property', 'og:title', head.title);
  meta('property', 'og:description', head.description);
  meta('property', 'og:url', head.canonical);
  meta('name', 'robots', head.noindex ? 'noindex' : undefined);
  link('canonical', { href: head.canonical });
  link('alternate', head.alternate);
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The same tags as `applyHead`, written into built HTML. Throws if the template has changed. */
export function headHtml(template: string, head: Head) {
  let html = template;
  const replace = (pattern: RegExp, tag: string) => {
    if (!pattern.test(html)) throw new Error(`index.html is missing ${pattern}`);
    html = html.replace(pattern, tag);
  };
  const attribute = escapeAttribute;
  replace(/<title>[\s\S]*?<\/title>/, `<title>${attribute(head.title)}</title>`);
  replace(
    /<meta\s+name="description"[\s\S]*?\/?>/,
    `<meta name="description" content="${attribute(head.description)}" />`,
  );
  replace(
    /<meta\s+property="og:title"[\s\S]*?\/?>/,
    `<meta property="og:title" content="${attribute(head.title)}" />`,
  );
  replace(
    /<meta\s+property="og:description"[\s\S]*?\/?>/,
    `<meta property="og:description" content="${attribute(head.description)}" />`,
  );
  replace(
    /<meta\s+property="og:url"[\s\S]*?\/?>/,
    `<meta property="og:url" content="${attribute(head.canonical)}" />`,
  );
  const extra = [
    `<link rel="canonical" href="${attribute(head.canonical)}" />`,
    head.noindex && '<meta name="robots" content="noindex" />',
    head.alternate &&
      `<link rel="alternate" type="${attribute(head.alternate.type)}" href="${attribute(head.alternate.href)}" />`,
  ].filter(Boolean);
  replace(/<link\s+rel="canonical"[\s\S]*?\/?>/, extra.join('\n    '));
  return html;
}
