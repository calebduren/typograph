import { typeset } from '@calebduren/typograph/markdown';
import source from '../public/integration.md?raw';
import { SiteFooter, SiteHeader } from './SiteHeader';

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/** GitHub's heading slugs, so the guide's own `#fragment` links keep working. */
function slug(html: string) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, name: string) => entities[name])
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

/** Heading ids for in-page links, and new tabs for links that leave the site. */
function linkable(html: string) {
  const seen = new Map<string, number>();
  return html
    .replace(/<h([2-6])>([\s\S]*?)<\/h\1>/g, (_, level: string, inner: string) => {
      const base = slug(inner);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return `<h${level} id="${count ? `${base}-${count}` : base}">${inner}</h${level}>`;
    })
    .replace(
      /<a href="(https?:[^"]*)">/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">',
    );
}

/**
 * The integration guide agents read at /integration.md, typeset for the web by the package.
 * Resolves to null when typesetting fails. Like the changelog, it is prerendered at build time
 * and typeset again before hydration.
 */
export function typesetGuide(): Promise<string | null> {
  // The guide is this repository's own Markdown, so its HTML is trusted.
  return typeset(source, { target: 'web', locale: 'en', spacing: true }).then(linkable, () => null);
}

export function IntegrationGuide({ html }: { html: string | null }) {
  return (
    <>
      <SiteHeader home="/" install="/#install" />
      <main className="changelog guide">
        <p className="guide-source">
          For coding agents: <a href="/integration.md">the same guide as Markdown</a>
        </p>
        {html === null ? (
          <p role="alert">
            The guide could not be typeset. <a href="/integration.md">Read the Markdown</a>.
          </p>
        ) : (
          <article
            className="changelog-body guide-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
