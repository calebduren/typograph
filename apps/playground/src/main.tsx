import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Copy, Check } from 'lucide-react';
import { agentPrompt } from './agent-prompts';
import { useScrollFade } from './use-scroll-fade';
import {
  defaultSettings,
  integrationCode,
  integrationStacks,
  settingsSummary,
  type IntegrationStack,
  type TypographySettings,
} from './integration-settings';
import benchmarkUrl from '../../../validation/chat-hardening-benchmark.json?url&no-inline';
import '@calebduren/typograph/hanging.css';
import './fonts.css';
import './landing.css';

const ChatComparison = lazy(() =>
  import('./ChatComparison').then((module) => ({ default: module.ChatComparison })),
);

function Integration({ settings }: { settings: TypographySettings }) {
  const [recipe, setRecipe] = useState<IntegrationStack>('AI Elements');
  const [mode, setMode] = useState<'prompt' | 'code'>('prompt');
  const [copiedContent, setCopiedContent] = useState('');
  const [error, setError] = useState('');
  const promptArea = useRef<HTMLDivElement>(null);
  useScrollFade(promptArea, `${recipe}:${mode}`);
  const content =
    mode === 'prompt' ? agentPrompt(recipe, settings) : integrationCode(recipe, settings);
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
    <section
      id="integrate"
      className="integration section-rule"
      aria-labelledby="integration-title"
    >
      <div className="section-intro">
        <h2 id="integration-title">
          A small addition.
          <br />
          Right where you render.
        </h2>
        <p>
          Add the selected refinements to your existing Markdown pipeline. Keep your fonts, your
          components, and your original messages.
        </p>
        <p className="muted">Works in the browser. No model call, API key, or new service.</p>
        <p className="selected-settings">
          <span>Your configuration</span>
          {settingsSummary(settings)}
        </p>
        <p>
          Building with an agent? Choose your stack and copy the prompt into your coding assistant.
        </p>
        <a className="underlined" href="/integration.md">
          Read the integration guide <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <p className="release-note">
          <code>npm install @calebduren/typograph</code>
        </p>
      </div>
      <div className="recipe">
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
            {copied ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Copy size={15} aria-hidden="true" />
            )}{' '}
            <span aria-live="polite">
              {copied ? 'Copied' : mode === 'prompt' ? 'Copy prompt' : 'Copy code'}
            </span>
          </button>
        </div>
        {mode === 'prompt' ? (
          <div
            ref={promptArea}
            className="agent-prompt scroll-fade"
            role="region"
            tabIndex={0}
            aria-label={`${recipe} agent prompt`}
            key={recipe}
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
            : 'A fixed English preset needs no finish callback. Changing rules at runtime? The guide includes the tested Streamdown wrapper.'}
        </p>
        <p role="alert" className="recipe-error" hidden={!error}>
          {error}
        </p>
      </div>
    </section>
  );
}

function Landing() {
  const [settings, setSettings] = useState(defaultSettings);
  useEffect(() => {
    // React mounts after navigation, so initial fragment targets do not exist yet.
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: 'instant' });
  }, []);
  return (
    <>
      <a className="skip-link" href="#demo">
        Skip to the comparison
      </a>
      <div className="page-frame">
        <header className="site-header" id="top">
          <a className="wordmark" href="#top" aria-label="Typograph home">
            typograph
          </a>
          <nav aria-label="Main navigation">
            <a href="#demo">Try it</a>
            <a href="#integrate">Integration</a>
            <a href="https://github.com/calebduren/typograph">
              GitHub <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </nav>
        </header>
        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <h1 id="hero-title">
                Nicer typography <br />
                for streaming AI.
              </h1>
              <p>
                Careful English punctuation for AI responses, with optional spacing that keeps
                related words together.
              </p>
              <p className="scope-line">
                English only <span aria-hidden="true">·</span> Open source{' '}
                <span aria-hidden="true">·</span> Runs locally
              </p>
            </div>
            <figure
              className="punctuation-proof"
              aria-label="The quick brown fox says, ‘Let’s go!’ Opening quotation mark hangs in lilac; smart punctuation is highlighted in blue."
            >
              <div className="proof-result" data-rulers="true" aria-hidden="true">
                <span className="typograph-opening">
                  <span data-change="hanging">“</span>
                </span>
                The quick
                <br />
                brown fox says,
                <br />
                <mark data-change="punctuation">‘</mark>Let<mark data-change="punctuation">’</mark>s
                go!<mark data-change="punctuation">’”</mark>
              </div>
            </figure>
          </section>
          <section className="comparison" aria-labelledby="comparison-title">
            <div className="section-heading">
              <div>
                <h2 id="comparison-title">Small changes. A better read.</h2>
                <p>The same words, with a little more care. Open Markdown to try your own.</p>
              </div>
            </div>
            <div id="demo" className="comparison-workspace">
              <Suspense fallback={<p role="status">Loading the comparison…</p>}>
                <ChatComparison settings={settings} onSettingsChange={setSettings} />
              </Suspense>
            </div>
          </section>
          <Integration settings={settings} />
          <section className="principles section-rule" aria-labelledby="care-title">
            <h2 id="care-title">Careful where it counts.</h2>
            <div className="principle-row">
              <h3>Prose gets the polish.</h3>
              <p>
                {settings.punctuation
                  ? 'Quotes and apostrophes follow their context, even across emphasis and links.'
                  : 'Smart punctuation is off. Original quote marks and apostrophes stay as written.'}{' '}
                {settings.spacing
                  ? 'Non-breaking spaces keep pairs like 30 min together.'
                  : 'Non-breaking spaces are off. Your original word spacing stays intact.'}
              </p>
            </div>
            <div className="principle-row">
              <h3>Literal stays literal.</h3>
              <p>
                Code, math, URLs, and link destinations keep their original characters. Your app
                retains the original message for storage and copying.
              </p>
            </div>
            <div className="principle-row">
              <h3>{settings.hanging ? 'An even reading edge.' : 'A stream has room to finish.'}</h3>
              <p>
                {settings.hanging
                  ? 'Opening quotes sit just outside the first line of paragraphs, headings, and list items. The helper uses real text, keeps copying intact, and needs no native browser support for hanging punctuation.'
                  : 'An opening quote can wait for its words. A partial “30 m” can still become “30 million.” Conservative choices come first.'}
              </p>
            </div>
          </section>
          <section id="scope" className="scope-section section-rule" aria-labelledby="scope-title">
            <div>
              <h2 id="scope-title">Small, by intention.</h2>
              <p>
                English only is the scope. A focused set of rules, with explicit limits and room for
                your app’s own choices.
              </p>
            </div>
            <div className="scope-details">
              <dl>
                <div>
                  <dt>Language</dt>
                  <dd>
                    One English house style. Set the response language explicitly; other or unknown
                    languages pass through.
                  </dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>
                    About 4 KB gzip for the core, including the spacing engine. Hanging punctuation
                    adds a separate small helper and stylesheet.{' '}
                    <a href={benchmarkUrl} className="underlined">
                      View the measurement
                    </a>
                    .
                  </dd>
                </div>
                <div>
                  <dt>Built on</dt>
                  <dd>
                    <a href="https://typehug.aliszu.com/" className="underlined">
                      Typehug
                    </a>{' '}
                    for optional no-break spacing. Remark for Markdown structure. MIT licensed.
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <a
                      href="https://www.npmjs.com/package/@calebduren/typograph"
                      className="underlined"
                    >
                      Version 0.1.0 on npm
                    </a>
                    . Tested with recorded streams; browser profiling and reading evaluations
                    continue.
                  </dd>
                </div>
              </dl>
              <div className="scope-limits">
                <h3>What it doesn’t do</h3>
                <p>
                  No language detection, regional quote styles, hyphenation, or automatic rewriting
                  of your content. No-break spacing is off by default. Very long tokens skip
                  optional spacing to avoid expensive processing.
                </p>
                <p>
                  Paste English prose into the demo. For mixed-language replies, the host app must
                  select English content or opt out. Selecting or copying displayed text includes
                  its typographic characters.
                </p>
              </div>
            </div>
          </section>
        </main>
        <footer className="site-footer">
          <a className="wordmark" href="#top">
            typograph
          </a>
          <span>Consider the details.</span>
          <div>
            <a href="https://calebduren.com">
              Caleb Durenberger <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Landing />);
