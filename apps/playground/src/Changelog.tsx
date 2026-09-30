import { typeset } from '@calebduren/typograph/markdown';
import source from '../../../CHANGELOG.md?raw';
import { SiteFooter, SiteHeader } from './SiteHeader';

/**
 * The repository changelog, typeset for the web by the package itself. Resolves to null when
 * typesetting fails. The build prerenders the result, and the client typesets again before it
 * hydrates, so both render the same markup.
 */
export function typesetChangelog(): Promise<string | null> {
  // The changelog is this repository's own Markdown, so its HTML is trusted.
  return typeset(source, { target: 'web', locale: 'en', spacing: true }).catch(() => null);
}

export function Changelog({ html }: { html: string | null }) {
  return (
    <>
      <SiteHeader home="/" install="/#install" />
      <main className="changelog">
        {html === null ? (
          <p role="alert">
            The changelog could not be typeset.{' '}
            <a href="https://github.com/calebduren/typograph/blob/main/CHANGELOG.md">
              Read it on GitHub
            </a>
            .
          </p>
        ) : (
          <article className="changelog-body" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
