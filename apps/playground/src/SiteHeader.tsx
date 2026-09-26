import { ArrowUpRight } from 'lucide-react';
import { version } from '../../../packages/chat-typography/package.json';
import { Kern } from './Kern';
import { LogoMark } from './LogoMark';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** Wordmark on the left; the changelog, source, and install on the right. */
export function SiteHeader({ home, install }: { home: string; install: string }) {
  return (
    <header className="site-header" id="top">
      <div className="header-inner">
        <a className="wordmark" href={home} aria-label="Typograph home">
          <LogoMark />
          <span aria-hidden="true">
            <Kern>typograph</Kern>
          </span>
        </a>
        <div className="header-end">
          <nav aria-label="Main navigation">
            <a href="/changelog">Changelog</a>
            <a href="https://github.com/calebduren/typograph" {...external}>
              GitHub <ArrowUpRight size={13} aria-hidden="true" strokeWidth={1.5} />
            </a>
          </nav>
          <a className="button button-secondary header-cta" href={install}>
            Install <span className="header-version">v{version}</span>
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="footer-mark" aria-hidden="true">
        <Kern>typograph</Kern>
      </p>
      <div className="footer-row">
        <span className="version">v{version}</span>
        <a href="https://calebduren.com/" {...external}>
          Caleb Durenberger <ArrowUpRight size={13} aria-hidden="true" strokeWidth={1.5} />
        </a>
      </div>
    </footer>
  );
}
