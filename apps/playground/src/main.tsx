import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { typesetText } from '@calebduren/typograph';
import { GradientBlinds } from './GradientBlinds';
import { HeroScene } from './HeroScene';
import { startSegmentThumbs } from './segments';
import { QuoteReveal } from './QuoteReveal';
import { microsecondsPerCall } from './speed';
import '@calebduren/typograph/hanging.css';
import './fonts.css';
import './landing.css';
import './product.css';

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
    <section id="integrate" className="band integration" aria-labelledby="integration-title">
      <div className="section-intro">
        <h2 id="integration-title">
          A small addition.
          <br />
          Right where you <em>render.</em>
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

const places = [
  {
    key: 'chat',
    title: 'Chat that streams',
    text: 'The Remark plugin typesets replies as tokens arrive, and holds back until a quote or unit settles.',
    call: "remarkPlugins={[[typography, { locale: 'en' }]]}",
  },
  {
    key: 'email',
    title: 'Email that lands',
    text: 'Finished Markdown becomes email HTML with real quotes and no-break spaces, which every client renders.',
    call: "await typeset(brief, { target: 'email' })",
  },
  {
    key: 'strings',
    title: 'Every string in your UI',
    text: 'Titles, toasts, and notifications. Synchronous, parses nothing, and never changes a string’s length.',
    call: 'typesetText(title)',
  },
  {
    key: 'html',
    title: 'Templates, untouched',
    text: 'Already HTML? Only typographic characters change, including template-escaped quotes. Markup stays byte for byte.',
    call: "await typeset(html, { input: 'html' })",
  },
];

const settledText = { locale: 'en', spacing: true } as const;
// Ember reds for the header blinds: crisp stripes under a spotlight, not a pastel wash.
const blinds = ['#ff6352', '#b3261a', '#3a0d08'];

function PlaceVisual({ kind }: { kind: string }) {
  const lines = useMemo(
    () => ({
      chat: typesetText(`"Ship it, then tell everyone." That's the plan.`, settledText),
      subject: typesetText(`"Atlas" is live — here's what's new`, settledText),
      toast: typesetText(`Saved. It's synced across 3 devices.`, settledText),
      title: typesetText(`Sam's brief: "Q3 review"`, settledText),
    }),
    [],
  );
  if (kind === 'chat') {
    return (
      <div className="visual visual-chat" aria-hidden="true">
        <span className="mini-bubble user">Summarize the launch?</span>
        <span className="mini-bubble ai">
          {lines.chat}
          <span className="caret" />
        </span>
      </div>
    );
  }
  if (kind === 'email') {
    return (
      <div className="visual visual-email" aria-hidden="true">
        <span className="mini-mail">
          <span className="mini-from">Assistant</span>
          <span className="mini-subject">{lines.subject}</span>
          <span className="mini-line" />
          <span className="mini-line short" />
        </span>
      </div>
    );
  }
  if (kind === 'strings') {
    return (
      <div className="visual visual-strings" aria-hidden="true">
        <span className="mini-toast">{lines.toast}</span>
        <span className="mini-toast faded">{lines.title}</span>
      </div>
    );
  }
  return (
    <div className="visual visual-html" aria-hidden="true">
      <code>
        {'<p>'}
        <span className="strike">&amp;quot;</span>
        <span className="hit">“</span>Hi,<span className="strike">&amp;quot;</span>
        <span className="hit">”</span> it<span className="strike">&amp;#39;</span>
        <span className="hit">’</span>s me{'</p>'}
      </code>
    </div>
  );
}

const promises = [
  {
    title: 'Literal stays literal',
    text: 'Code, math, URLs, link destinations, markup, and escaped quotes pass through exactly as they arrived.',
  },
  {
    title: 'Your text stays yours',
    text: 'Typography is presentation only. Store and copy the original message; the package never rewrites content.',
  },
  {
    title: 'Private by design',
    text: 'Pure functions with one small dependency. No network, no telemetry, no model calls. It runs where you render.',
  },
];

function Landing() {
  const [settings, setSettings] = useState(defaultSettings);
  const microseconds = microsecondsPerCall();
  useEffect(() => {
    // React mounts after navigation, so initial fragment targets do not exist yet.
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: 'instant' });
    startSegmentThumbs();
  }, []);
  return (
    <>
      <a className="skip-link" href="#finished">
        Skip to the demo
      </a>
      <div className="hero-backdrop">
        <GradientBlinds
          gradientColors={blinds}
          angle={18}
          noise={0.1}
          blindCount={14}
          blindMinWidth={72}
          spotlightRadius={0.62}
          spotlightSoftness={1.15}
          spotlightOpacity={0.9}
          mouseDampening={0.25}
          pointerTarget="window"
        />
      </div>
      <header className="site-header" id="top">
        <div className="header-inner">
          <a className="wordmark" href="#top" aria-label="Typograph home">
            typograph
          </a>
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
          <a className="button button-light header-cta" href="#install">
            Install
          </a>
        </div>
      </header>
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <a className="badge" href="#finished">
            <span className="badge-new">New</span>
            HTML input in v{version}
            <ArrowUpRight size={13} aria-hidden="true" strokeWidth={1.75} />
          </a>
          <h1 id="hero-title">
            Every word your AI writes, <em>typeset.</em>
          </h1>
          <p className="hero-lede">
            Typograph fixes the straight quotes, stray apostrophes, and breakable spaces in model
            output. In chat streams, in email, and in every string in your product.
          </p>
          <div className="hero-actions">
            <a className="button button-light" href="#install">
              Get started
            </a>
            <a className="button button-dark" href="#finished">
              Try it on your text
            </a>
          </div>
          <CopyCommand command="npm install @calebduren/typograph" />
          <HeroScene />
        </section>

        <section className="stats" aria-label="Measured facts">
          <div>
            <strong>
              {microseconds.toFixed(microseconds < 10 ? 1 : 0)}
              <small>µs</small>
            </strong>
            <span>per call, measured just now in your browser</span>
          </div>
          <div>
            <strong>
              {kb}
              <small>KB</small>
            </strong>
            <span>
              gzip, spacing engine included.{' '}
              <a href={benchmarkUrl} target="_blank" rel="noopener noreferrer">
                View the measurement
              </a>
            </span>
          </div>
          <div>
            <strong>0</strong>
            <span>network requests. It never phones home.</span>
          </div>
          <div>
            <strong>1</strong>
            <span>runtime dependency, for no-break spacing</span>
          </div>
        </section>

        <section className="band band-reveal" aria-labelledby="reveal-title">
          <h2 id="reveal-title" className="sr-only">
            Before and after
          </h2>
          <QuoteReveal />
        </section>

        <section className="band" aria-labelledby="places-title">
          <div className="band-head">
            <h2 id="places-title">
              One engine, <em>everywhere</em> your AI writes.
            </h2>
            <p>
              Four entry points share the same rules, so a quote curls the same way in a chat reply,
              an email, and a push notification.
            </p>
          </div>
          <ul className="places">
            {places.map((place) => (
              <li key={place.key} className={`place place-${place.key}`}>
                <PlaceVisual kind={place.key} />
                <div className="place-copy">
                  <h3>{place.title}</h3>
                  <p>{place.text}</p>
                  <code>{place.call}</code>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="finished" className="band" aria-labelledby="finished-title">
          <div className="band-head">
            <h2 id="finished-title">
              Try it on <em>your own</em> text.
            </h2>
            <p>
              This is the published package, running in your browser. Paste a brief, an email
              template, or a notification. Nothing leaves the page.
            </p>
          </div>
          <Suspense fallback={<p role="status">Loading the workbench…</p>}>
            <FinishedDemo settings={settings} onSettingsChange={setSettings} />
          </Suspense>
        </section>

        <section className="band comparison" aria-labelledby="comparison-title">
          <div className="band-head">
            <h2 id="comparison-title">
              Built for text that <em>hasn’t finished</em> arriving.
            </h2>
            <p>
              An opening quote may not have closed yet, and “30 m” may become “30 million.” Replay a
              recorded stream through the real plugin, or edit it.
            </p>
          </div>
          <div id="demo" className="comparison-workspace">
            <Suspense fallback={<p role="status">Loading the comparison…</p>}>
              <ChatComparison settings={settings} onSettingsChange={setSettings} />
            </Suspense>
          </div>
        </section>

        <section className="band" aria-labelledby="care-title">
          <div className="band-head">
            <h2 id="care-title">
              Careful where it <em>counts.</em>
            </h2>
            <p>
              Apart from the optional hanging quote, every edit swaps a character in prose for its
              typographic form.
            </p>
          </div>
          <ul className="promises">
            {promises.map((promise) => (
              <li key={promise.title}>
                <h3>{promise.title}</h3>
                <p>{promise.text}</p>
              </li>
            ))}
          </ul>
          <div className="limits">
            <h3>Known limits</h3>
            <p>
              English only, with one house style; other languages pass through. No dashes, ellipses,
              primes, or hyphenation. An inch mark inside an open quotation can read as its closing
              quote. Email output never hangs punctuation, because mail clients do not render it.
            </p>
          </div>
        </section>

        <div id="install" className="install-anchor" />
        <Integration settings={settings} onSettingsChange={setSettings} />

        <section id="scope" className="band" aria-labelledby="scope-title">
          <div className="band-head">
            <h2 id="scope-title">Specifications</h2>
          </div>
          <dl className="specs">
            <div>
              <dt>Package</dt>
              <dd>
                <a
                  href="https://www.npmjs.com/package/@calebduren/typograph"
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
              <dd>{kb} KB gzip for the core, including the spacing engine</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>ESM. Node 22+ and modern browsers. No install scripts or telemetry.</dd>
            </div>
            <div>
              <dt>Dependencies</dt>
              <dd>
                One:{' '}
                <a href="https://typehug.aliszu.com/" target="_blank" rel="noopener noreferrer">
                  Typehug
                </a>
                . Parsers for <code>typeset</code> are yours, as optional peers.
              </dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>English, one house style. Other languages pass through.</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>
                MIT.{' '}
                <a
                  href="https://github.com/calebduren/typograph"
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
        <p className="footer-mark" aria-hidden="true">
          typograph
        </p>
        <div className="footer-row">
          <span className="version">v{version}</span>
          <a href="https://calebduren.com/" target="_blank" rel="noopener noreferrer">
            Caleb Durenberger <ArrowUpRight size={13} aria-hidden="true" strokeWidth={1.5} />
          </a>
        </div>
      </footer>
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
