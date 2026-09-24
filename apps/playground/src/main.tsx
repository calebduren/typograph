import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight } from 'lucide-react';
import { TypographyControls } from './TypographyControls';
import { agentPrompt } from './agent-prompts';
import { useScrollFade } from './use-scroll-fade';
import {
  defaultSettings,
  integrationCode,
  integrationStacks,
  type IntegrationStack,
  type TypographySettings,
} from './integration-settings';
import benchmarkUrl from '../../../validation/chat-hardening-benchmark.json?url&no-inline';
import benchmark from '../../../validation/chat-hardening-benchmark.json';
import { version } from '../../../packages/chat-typography/package.json';
import { HeroProof } from './HeroProof';
import '@calebduren/typograph/hanging.css';
import './fonts.css';
import './landing.css';
import './site.css';

const ChatComparison = lazy(() =>
  import('./ChatComparison').then((module) => ({ default: module.ChatComparison })),
);
const FinishedDemo = lazy(() =>
  import('./FinishedDemo').then((module) => ({ default: module.FinishedDemo })),
);
const Specimen = lazy(() => import('./Specimen').then((module) => ({ default: module.Specimen })));

function Integration({
  settings,
  onSettingsChange,
}: {
  settings: TypographySettings;
  onSettingsChange: (settings: TypographySettings) => void;
}) {
  const [recipe, setRecipe] = useState<IntegrationStack>('AI Elements');
  const [mode, setMode] = useState<'prompt' | 'code'>('prompt');
  const [copiedContent, setCopiedContent] = useState('');
  const [error, setError] = useState('');
  const promptArea = useRef<HTMLDivElement>(null);
  useScrollFade(promptArea, mode);
  const content = mode === 'prompt' ? agentPrompt(settings) : integrationCode(recipe, settings);
  const copied = copiedContent === content;
  useEffect(() => {
    // This state mirrors the selected recipe and clears a stale copy error.
    // oxlint-disable-next-line react/set-state-in-effect
    setError('');
  }, [content]);
  useEffect(() => {
    if (!copiedContent) return;
    const timer = window.setTimeout(() => setCopiedContent(''), 3000);
    return () => window.clearTimeout(timer);
  }, [copiedContent]);
  return (
    <section id="integrate" className="section integration" aria-labelledby="integration-title">
      <div className="section-intro">
        <h2 id="integration-title">
          A small addition.
          <br />
          Right where you render.
        </h2>
        <p className="muted">Works in the browser. No model call, API key, or new service.</p>
        <p className="release-note">
          <code>npm install @calebduren/typograph</code>
        </p>
        <div
          className="integration-settings"
          role="group"
          aria-label="Integration typography settings"
        >
          <TypographyControls settings={settings} onSettingsChange={onSettingsChange} />
        </div>
        <p>
          Building with an agent? Copy the prompt into your coding assistant. It will find the right
          integration for your app.
        </p>
        <a className="underlined" href="/integration.md" target="_blank" rel="noopener noreferrer">
          Read the integration guide <ArrowUpRight size={13} aria-hidden="true" strokeWidth={1.5} />
        </a>
      </div>
      <div className="recipe">
        <div className="recipe-tools">
          <div
            className="recipe-modes segmented-control"
            role="group"
            aria-label="Integration format"
          >
            {(['prompt', 'code'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setCopiedContent('');
                  setError('');
                }}
              >
                {value === 'prompt' ? 'Agent prompt' : 'Code'}
              </button>
            ))}
          </div>
          <button
            className="recipe-copy"
            aria-label={mode === 'prompt' ? 'Copy agent prompt' : 'Copy integration code'}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(content);
                setCopiedContent(content);
                setError('');
              } catch {
                setCopiedContent('');
                setError(
                  `Copy unavailable. Select the ${mode === 'prompt' ? 'prompt' : 'code'} below and copy it manually.`,
                );
              }
            }}
          >
            <span aria-live="polite">
              {copied ? 'Copied' : mode === 'prompt' ? 'Copy prompt' : 'Copy code'}
            </span>
          </button>
        </div>
        {mode === 'code' && (
          <div className="recipe-tab-row">
            <div
              className="recipe-tabs segmented-control"
              role="group"
              aria-label="Integration examples"
            >
              {integrationStacks.map((name) => (
                <button
                  key={name}
                  aria-pressed={recipe === name}
                  onClick={() => {
                    setRecipe(name);
                    setCopiedContent('');
                    setError('');
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === 'prompt' ? (
          <div
            ref={promptArea}
            className="agent-prompt scroll-fade"
            role="region"
            tabIndex={0}
            aria-label="Typography agent prompt"
          >
            <div>{content}</div>
          </div>
        ) : (
          <pre tabIndex={0} aria-label={`${recipe} code example`}>
            <code>{content}</code>
          </pre>
        )}
        <p className="recipe-note">
          {mode === 'prompt'
            ? 'Includes installation, English-only defaults, streaming behavior, and checks for your app.'
            : recipe === 'Finished text'
              ? 'Typeset once when the text is complete, then store or send the result. Email output leaves out hanging markup.'
              : 'A fixed English preset needs no finish callback. Changing rules at runtime? The guide includes the tested Streamdown wrapper.'}
        </p>
        <p role="alert" className="recipe-error" hidden={!error}>
          {error}
        </p>
      </div>
    </section>
  );
}

const kb = (benchmark.bundle.gzipBytes / 1024).toFixed(1);

function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);
  return (
    <div className="command">
      <code>
        <span className="command-prompt" aria-hidden="true">
          $
        </span>
        {command}
      </code>
      <button
        aria-label="Copy install command"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setState('copied');
          } catch {
            setState('failed');
          }
        }}
      >
        <span aria-live="polite">
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select to copy' : 'Copy'}
        </span>
      </button>
    </div>
  );
}

const entries = [
  {
    name: 'Streaming chat',
    call: `import typography from '@calebduren/typograph';

remarkPlugins={[[typography, { locale: 'en' }]]}`,
    note: 'A Remark plugin for text that is still arriving. It holds back at the right edge until a quote or unit settles.',
    meta: 'Remark · streaming-safe',
  },
  {
    name: 'Finished Markdown',
    call: `import { typeset } from '@calebduren/typograph/static';

await typeset(brief, { target: 'email', locale: 'en' });`,
    note: 'One call for text that is complete before anyone reads it. Returns web HTML, email HTML, or Markdown with its formatting kept.',
    meta: 'web · email · markdown',
  },
  {
    name: 'HTML',
    call: `await typeset(template, {
  input: 'html', target: 'email', locale: 'en',
});`,
    note: 'For prose that is already HTML. Only typographic characters change; markup, attributes, and comments stay byte for byte.',
    meta: 'escaped quotes included',
  },
  {
    name: 'Plain strings',
    call: `import { typesetText } from '@calebduren/typograph';

typesetText(title, { locale: 'en' });`,
    note: 'Titles, notifications, subject lines. Synchronous, parses nothing, and returns a string of the same length.',
    meta: 'sync · length-preserving',
  },
];

const changes = [
  {
    from: '"Hi"',
    to: '“Hi”',
    title: 'Quotes',
    text: 'Paired by context, across emphasis and links.',
  },
  {
    from: "it's",
    to: 'it’s',
    title: 'Apostrophes',
    text: 'Contractions and elisions, including ’90s and rock ’n’ roll.',
  },
  {
    from: '30 min',
    to: '30\u00a0min',
    title: 'No-break spaces',
    text: 'Units, initials, and abbreviations stay on one line. Opt-in.',
  },
  {
    from: '“Hi”',
    to: '“Hi”',
    title: 'Hanging quotes',
    text: 'Opening quotes sit outside the text edge on the web. Opt-in.',
    hanging: true,
  },
];

/** Mark the characters that differ, and draw no-break spaces so they are visible. */
function Changed({ from, to }: { from: string; to: string }) {
  return [...to].map((char, index) =>
    char === '\u00a0' ? (
      <span key={index} className="pair-space" aria-label="no-break space" />
    ) : char !== from[index] ? (
      <span key={index} className="pair-hit">
        {char}
      </span>
    ) : (
      char
    ),
  );
}

const untouched = [
  'Code, math, URLs, and link destinations',
  'HTML markup, attributes, and comments',
  'Backslash-escaped quotes in Markdown',
  'Text marked as another language, or with translate="no"',
  'The message you store: typography is presentation only',
];

const limits = [
  'English only, with one house style. Other languages pass through.',
  'No dashes, ellipses, primes, or hyphenation.',
  'An inch mark inside an open quotation can read as its closing quote.',
  'Email output never hangs punctuation; mail clients do not render it.',
];

function Landing() {
  const [settings, setSettings] = useState(defaultSettings);
  useEffect(() => {
    // React mounts after navigation, so initial fragment targets do not exist yet.
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: 'instant' });
  }, []);
  return (
    <>
      <a className="skip-link" href="#finished">
        Skip to the demo
      </a>
      <div className="page-frame">
        <header className="site-header" id="top">
          <div className="wordmark-container">
            <a className="wordmark" href="#top" aria-label="Typograph home">
              Typograph
            </a>
            <p className="version">v{version}</p>
          </div>
          <nav aria-label="Main navigation">
            <a href="#finished">Try it</a>
            <a href="#demo">Streaming</a>
            <a href="#integrate">Integration</a>
            <a
              href="https://github.com/calebduren/typograph"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub <ArrowUpRight size={13} aria-hidden="true" strokeWidth={1.5} />
            </a>
          </nav>
        </header>
        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-head">
              <h1 id="hero-title">
                Better typography <br />
                for AI-generated text.
              </h1>
              <div className="hero-aside">
                <p>
                  Typograph turns the straight quotes, apostrophes, and loose spaces in model output
                  into real typography, wherever you render it. It changes characters only, and
                  never code, links, or the text you store.
                </p>
                <CopyCommand command="npm install @calebduren/typograph" />
                <ul className="facts" aria-label="Package facts">
                  <li>MIT</li>
                  <li>{kb} KB gzip</li>
                  <li>1 dependency</li>
                  <li>No network</li>
                </ul>
              </div>
            </div>
            <HeroProof />
          </section>

          <section id="finished" className="section" aria-labelledby="finished-title">
            <div className="section-head">
              <h2 id="finished-title">Try it on your own text.</h2>
              <p>
                This is the published package, running in your browser. Paste a brief, an email
                template, or a notification. Nothing leaves the page.
              </p>
            </div>
            <Suspense fallback={<p role="status">Loading the workbench…</p>}>
              <FinishedDemo settings={settings} onSettingsChange={setSettings} />
            </Suspense>
          </section>

          <section className="section comparison" aria-labelledby="comparison-title">
            <div className="section-head">
              <h2 id="comparison-title">Streaming, token by token.</h2>
              <p>
                Chat text arrives unfinished. An opening quote may not have closed, and “30 m” may
                become “30 million.” Replay a recorded stream through the real plugin, or edit it.
              </p>
            </div>
            <div id="demo" className="comparison-workspace">
              <Suspense fallback={<p role="status">Loading the comparison…</p>}>
                <ChatComparison settings={settings} onSettingsChange={setSettings} />
              </Suspense>
            </div>
          </section>

          <section className="section" aria-labelledby="entries-title">
            <div className="section-head">
              <h2 id="entries-title">Four entry points, one engine.</h2>
              <p>
                Every entry point runs the same rules, so a quote is curled the same way in a chat
                reply, an email, and a push notification.
              </p>
            </div>
            <ul className="entries">
              {entries.map((entry) => (
                <li key={entry.name}>
                  <div className="entry-head">
                    <h3>{entry.name}</h3>
                    <span>{entry.meta}</span>
                  </div>
                  <pre>
                    <code>{entry.call}</code>
                  </pre>
                  <p>{entry.note}</p>
                </li>
              ))}
            </ul>
          </section>

          <Integration settings={settings} onSettingsChange={setSettings} />

          <section className="section" aria-labelledby="care-title">
            <div className="section-head">
              <h2 id="care-title">What changes, and what never does.</h2>
              <p>
                Apart from the optional hanging quote, every edit swaps a character in prose for its
                typographic form. Everything else passes through exactly as it arrived.
              </p>
            </div>
            <div className="ledger">
              <div>
                <h3>Changes</h3>
                <ul className="ledger-changes">
                  {changes.map((change) => (
                    <li key={change.title}>
                      <span className="pair" aria-hidden="true">
                        <span className="from">{change.from}</span>
                        <span className="arrow">→</span>
                        <span className="to" data-hanging={change.hanging}>
                          <Changed from={change.from} to={change.to} />
                        </span>
                      </span>
                      <span className="ledger-text">
                        <strong>{change.title}.</strong> {change.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Never touched</h3>
                <ul className="ledger-list">
                  {untouched.map((item) => (
                    <li key={item}>
                      {item.includes('translate="no"') ? (
                        <>
                          {item.replace('translate="no"', '')}
                          <code>translate="no"</code>
                        </>
                      ) : (
                        item
                      )}
                    </li>
                  ))}
                </ul>
                <h3>Known limits</h3>
                <ul className="ledger-list">
                  {limits.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section id="scope" className="section" aria-labelledby="scope-title">
            <div className="section-head">
              <h2 id="scope-title">Specifications.</h2>
            </div>
            <dl className="specs">
              <div>
                <dt>Package</dt>
                <dd>
                  <a
                    href="https://www.npmjs.com/package/@calebduren/typograph"
                    className="underlined"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @calebduren/typograph
                  </a>{' '}
                  {version}
                </dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>
                  {kb} KB gzip for the core, including the spacing engine.{' '}
                  <a
                    href={benchmarkUrl}
                    className="underlined"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View the measurement
                  </a>
                </dd>
              </div>
              <div>
                <dt>Runtime</dt>
                <dd>ESM. Node 22+ and modern browsers. No install scripts or telemetry.</dd>
              </div>
              <div>
                <dt>Dependencies</dt>
                <dd>
                  One:{' '}
                  <a
                    href="https://typehug.aliszu.com/"
                    className="underlined"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Typehug
                  </a>{' '}
                  for no-break spacing. Parsers for <code>typeset</code> are your own, as optional
                  peers.
                </dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>English, one house style. Set the language explicitly; others pass through.</dd>
              </div>
              <div>
                <dt>License</dt>
                <dd>
                  MIT.{' '}
                  <a
                    href="https://github.com/calebduren/typograph"
                    className="underlined"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Source on GitHub
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </main>
        <footer className="site-footer">
          <div className="wordmark-container">
            <a className="wordmark" href="#top">
              Typograph
            </a>
            <p className="version">v{version}</p>
          </div>
          <a href="https://calebduren.com/" target="_blank" rel="noopener noreferrer">
            Caleb Durenberger <ArrowUpRight size={13} aria-hidden="true" strokeWidth={1.5} />
          </a>
        </footer>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  window.location.pathname === '/specimen' ? (
    <Suspense fallback={<p role="status">Loading the specimen…</p>}>
      <Specimen />
    </Suspense>
  ) : (
    <Landing />
  ),
);
