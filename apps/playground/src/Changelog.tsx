import { useEffect, useState } from 'react';
import { typeset } from '@calebduren/typograph/static';
import source from '../../../CHANGELOG.md?raw';
import { SiteFooter, SiteHeader } from './SiteHeader';

/** The repository changelog, typeset for the web by the package itself. */
export function Changelog() {
  const [html, setHtml] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    document.title = 'Changelog — Typograph';
    // The changelog is this repository's own Markdown, so its HTML is trusted.
    typeset(source, { target: 'web', locale: 'en', spacing: true })
      .then(setHtml)
      .catch(() => setFailed(true));
  }, []);
  return (
    <>
      <SiteHeader home="/" install="/#install" />
      <main className="changelog">
        {failed ? (
          <p role="alert">
            The changelog could not be typeset.{' '}
            <a href="https://github.com/calebduren/typograph/blob/main/CHANGELOG.md">
              Read it on GitHub
            </a>
            .
          </p>
        ) : (
          <article
            className="changelog-body"
            aria-busy={!html}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
