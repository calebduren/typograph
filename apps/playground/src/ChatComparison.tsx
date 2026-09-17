import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
} from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Streamdown, defaultRemarkPlugins } from 'streamdown';
import hangingPunctuation from '@typograph/chat/hanging';
import '@typograph/chat/hanging.css';
import { chunkEnds, example, remarkPreview, previewRehypePlugins } from './chat-preview';
import { Toggle } from './Toggle';
import { useScrollFade } from './use-scroll-fade';
import { settingsSummary, type TypographySettings } from './integration-settings';

const originalSettings: TypographySettings = { punctuation: false, spacing: false, hanging: false };
const defaults = Object.values(defaultRemarkPlugins);
const hangingPlugins: ComponentProps<typeof Streamdown>['rehypePlugins'] = [
  ...previewRehypePlugins,
  [hangingPunctuation, { locale: 'en' }],
];
const allowedTags = { mark: [] };
const plainComponents: ComponentProps<typeof Streamdown>['components'] = {
  img: ({ alt }) => <span className="image-description">[Image: {alt || 'no description'}]</span>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};
const Response = memo(function Response({
  text,
  settings,
  highlight,
  playing,
}: {
  text: string;
  settings: TypographySettings;
  highlight: boolean;
  playing: boolean;
}) {
  const { punctuation, spacing, hanging } = settings;
  // Keep annotation markup stable; Show changes only reveals its backgrounds.
  const remarkPlugins = useMemo<ComponentProps<typeof Streamdown>['remarkPlugins']>(
    () =>
      punctuation || spacing
        ? [...defaults, [remarkPreview, { punctuation, spacing, highlight: true }]]
        : defaults,
    [punctuation, spacing],
  );
  // Streamdown 2.6 observes `plugins`, but not remark/rehype configuration changes.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- intentionally refresh plugin identity when settings change
  const plugins = useMemo(() => ({}), [remarkPlugins, hanging]);
  return (
    <Streamdown
      remarkPlugins={remarkPlugins}
      plugins={plugins}
      components={plainComponents}
      rehypePlugins={hanging ? hangingPlugins : previewRehypePlugins}
      allowedTags={allowedTags}
      controls={false}
      isAnimating={playing}
      lineNumbers={false}
      codeBlockMaxHeight={0}
      tableMaxHeight={0}
      className={`response-prose${highlight ? ' show-changes' : ''}`}
    >
      {text}
    </Streamdown>
  );
});

function ConversationContext({
  question,
  thinking,
  running,
  complete,
}: {
  question: string;
  thinking: boolean;
  running: boolean;
  complete: boolean;
}) {
  return (
    <div className="conversation-context reading">
      <div className="chat-user">
        <span>You</span>
        <p>{question}</p>
      </div>
      <div className="chat-agent-label">
        Assistant{' '}
        <span>
          {thinking
            ? running
              ? 'Thinking…'
              : 'Thinking paused'
            : complete
              ? 'Finished thinking'
              : running
                ? 'Writing…'
                : 'Writing paused'}
        </span>
      </div>
      {thinking && <p className="thinking-note">Preparing a clear, considered response.</p>}
    </div>
  );
}

export function ChatComparison({
  settings,
  onSettingsChange,
}: {
  settings: TypographySettings;
  onSettingsChange: (settings: TypographySettings) => void;
}) {
  const [sourceView, setSourceView] = useState<'text' | 'markdown'>('text');
  const [source, setSource] = useState<string>(example.text);
  const [cursor, setCursor] = useState(Number.MAX_SAFE_INTEGER);
  const [running, setRunning] = useState(false);
  const [width, setWidth] = useState(48);
  const [highlight, setHighlight] = useState(false);
  const [mobileView, setMobileView] = useState('formatted');
  const [mode, setMode] = useState<'text' | 'conversation'>('text');
  const scrollArea = useRef<HTMLDivElement>(null);
  useScrollFade(scrollArea);
  const followStream = useRef(true);
  const custom = source !== example.text;
  const ends = useMemo(() => chunkEnds(source), [source]);
  const position = Math.max(0, Math.min(cursor, ends.length));
  const complete = cursor >= ends.length;
  const thinking = mode === 'conversation' && cursor === -1;
  const playing = running && !complete && !thinking;
  const visible = source.slice(0, ends[position - 1] ?? 0);
  const rulers = highlight && settings.hanging;

  useEffect(() => {
    if (!running || complete) return;
    if (thinking) {
      const timer = window.setTimeout(() => setCursor(0), 1100);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setInterval(
      () => setCursor((current) => Math.min(current + 1, ends.length)),
      85,
    );
    return () => window.clearInterval(timer);
  }, [running, complete, thinking, ends.length]);

  useEffect(() => {
    const area = scrollArea.current;
    if (area && running && followStream.current) area.scrollTop = area.scrollHeight;
  }, [visible, running]);

  function changeSource(text: string) {
    setSource(text);
    setCursor(Number.MAX_SAFE_INTEGER);
    setRunning(false);
  }
  function replay() {
    if (complete) {
      followStream.current = true;
      if (scrollArea.current) scrollArea.current.scrollTop = 0;
      setCursor(mode === 'conversation' ? -1 : 0);
    }
    setRunning(!running || complete);
  }

  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <div className="section-heading">
        <div>
          <h2 id="comparison-title">Small changes. A better read.</h2>
          <p>The same words, with a little more care. Open Markdown to try your own.</p>
        </div>
      </div>
      <div id="demo" className="comparison-workspace">
        <div className="comparison-controls">
          <div className="typography-settings" role="group" aria-label="Typography settings">
            <Toggle
              label="Smart punctuation"
              checked={settings.punctuation}
              onChange={(punctuation) => onSettingsChange({ ...settings, punctuation })}
            />
            <Toggle
              label="Non-breaking spaces"
              checked={settings.spacing}
              onChange={(spacing) => onSettingsChange({ ...settings, spacing })}
            />
            <Toggle
              label="Hanging punctuation"
              checked={settings.hanging}
              onChange={(hanging) => onSettingsChange({ ...settings, hanging })}
            />
            <p>
              Your selection updates the preview, code, and agent prompts below.
              {settings.hanging && ' Hanging applies to opening quotes in paragraphs and headings.'}
            </p>
          </div>
          <div className="demo-toolbar">
            <div className="preview-modes segmented-control" role="group" aria-label="Preview mode">
              {(['text', 'conversation'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value);
                    if (cursor === -1) setCursor(0);
                  }}
                >
                  {value === 'text' ? 'Text' : 'Conversation'}
                </button>
              ))}
            </div>
            {custom && (
              <button className="reset-example" onClick={() => changeSource(example.text)}>
                Reset example
              </button>
            )}
          </div>
          <div
            className="mobile-comparison-switch segmented-control"
            role="group"
            aria-label="Compare text"
          >
            <button
              aria-pressed={mobileView === 'original'}
              onClick={() => setMobileView('original')}
            >
              Original
            </button>
            <button
              aria-pressed={mobileView === 'formatted'}
              onClick={() => setMobileView('formatted')}
            >
              With Typograph
            </button>
          </div>
        </div>
        <div
          className="comparison-frame"
          data-view={mobileView}
          style={{ '--reading-width': `${width}ch` } as CSSProperties}
        >
          <div className="comparison-headings">
            <div className="pane-heading original-pane">
              <h3>Original</h3>
              <div
                className="segmented-control source-modes"
                role="group"
                aria-label="Original view"
              >
                <button aria-pressed={sourceView === 'text'} onClick={() => setSourceView('text')}>
                  Text
                </button>
                <button
                  aria-pressed={sourceView === 'markdown'}
                  onClick={() => setSourceView('markdown')}
                >
                  Markdown
                </button>
              </div>
            </div>
            <div className="pane-heading formatted-pane">
              <h3>With Typograph</h3>
              <Toggle label="Show changes" checked={highlight} onChange={setHighlight} />
            </div>
          </div>
          <span className="sr-only">{settingsSummary(settings)}</span>
          <div
            ref={scrollArea}
            className="preview-scroll scroll-fade"
            tabIndex={0}
            role="region"
            aria-label="Text comparison"
            onScroll={(event) => {
              const area = event.currentTarget;
              followStream.current = area.scrollHeight - area.scrollTop - area.clientHeight < 32;
            }}
          >
            <div className="comparison-columns">
              <div className="comparison-pane original-pane">
                <div hidden={sourceView !== 'text'} role="region" aria-label="Original example">
                  {mode === 'conversation' && (
                    <ConversationContext
                      question={custom ? 'How would you phrase this response?' : example.question}
                      thinking={thinking}
                      running={running}
                      complete={complete}
                    />
                  )}
                  <div
                    className="reading response-reading"
                    data-testid="original-response"
                    data-rulers={rulers}
                  >
                    {visible ? (
                      <Response
                        text={visible}
                        settings={originalSettings}
                        highlight={false}
                        playing={playing}
                      />
                    ) : (
                      <p className="empty-text">
                        {!source
                          ? 'Open Markdown to add some English text.'
                          : thinking
                            ? 'The response will appear here.'
                            : 'The first words are on their way.'}
                      </p>
                    )}
                  </div>
                </div>
                <div hidden={sourceView !== 'markdown'}>
                  <div className="reading source-field" data-rulers={rulers}>
                    <div className="source-sizer" aria-hidden="true">
                      {source + ' '}
                    </div>
                    <textarea
                      id="source-text"
                      className="source-input"
                      aria-label="Original Markdown"
                      aria-describedby="source-note"
                      data-testid="source-editor"
                      maxLength={12000}
                      value={source}
                      spellCheck={false}
                      placeholder={'"Your words go here."'}
                      onChange={(event) => changeSource(event.target.value)}
                    />
                  </div>
                  <p className="source-note" id="source-note">
                    Your text stays in this browser.
                    <span>{source.length.toLocaleString()} / 12,000</span>
                  </p>
                </div>
              </div>
              <div
                className="comparison-pane formatted-pane"
                role="region"
                aria-label="Formatted example"
              >
                {mode === 'conversation' && (
                  <ConversationContext
                    question={custom ? 'How would you phrase this response?' : example.question}
                    thinking={thinking}
                    running={running}
                    complete={complete}
                  />
                )}
                <div
                  className="reading response-reading"
                  data-testid="formatted-response"
                  aria-label="Response with Typograph"
                  data-rulers={rulers}
                >
                  {visible ? (
                    <Response
                      text={visible}
                      settings={settings}
                      highlight={highlight}
                      playing={playing}
                    />
                  ) : (
                    <p className="empty-text">
                      {!source
                        ? 'Add some English text in Original to begin.'
                        : thinking
                          ? 'The response will appear here.'
                          : 'The first words are on their way.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="comparison-legend" aria-hidden={!highlight} data-visible={highlight}>
            <div className="change-key" aria-label="Highlight key">
              {settings.punctuation && (
                <span>
                  <i data-change="punctuation" aria-hidden="true" />
                  Smart punctuation
                </span>
              )}
              {settings.spacing && (
                <span>
                  <i data-change="spacing" aria-hidden="true" />
                  Non-breaking space
                </span>
              )}
              {settings.hanging && (
                <span>
                  <i data-change="hanging" aria-hidden="true" />
                  Hanging quote
                </span>
              )}
              {!settings.punctuation && !settings.spacing && !settings.hanging && (
                <span>Turn on a refinement to see its changes.</span>
              )}
            </div>
          </div>
        </div>
        <div className="playback-controls">
          <button className="replay-button" disabled={!source} onClick={replay}>
            {running && !complete ? (
              <Pause size={16} aria-hidden="true" />
            ) : complete ? (
              <RotateCcw size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            {running && !complete ? 'Pause' : complete ? 'Replay stream' : 'Continue'}
          </button>
          <label className="timeline">
            <span className="sr-only">Stream progress</span>
            <input
              aria-label="Stream progress"
              type="range"
              min={0}
              max={Math.max(1, ends.length)}
              value={position}
              disabled={!source}
              onChange={(event) => {
                setRunning(false);
                setCursor(Number(event.target.value));
              }}
            />
          </label>
          <span className="playback-state" data-testid="playback-state">
            {running && thinking
              ? 'Thinking'
              : playing
                ? 'Streaming'
                : complete
                  ? 'Complete'
                  : 'Paused'}
          </span>
          <label
            className="width-control"
            title="ch scales with the font’s zero glyph; it is not an exact character count."
          >
            Measure{' '}
            <input
              aria-label="Reading width"
              type="range"
              min={28}
              max={64}
              step={2}
              value={width}
              onChange={(event) => setWidth(Number(event.target.value))}
            />
            <output>{width} ch max</output>
          </label>
        </div>
        <div className="demo-caption">
          <p>
            {custom
              ? 'Try quotes, apostrophes, links, and code. Only English prose is refined.'
              : example.note}
          </p>
          <span>
            {mode === 'conversation'
              ? 'Scripted conversation · No model call'
              : 'English only · Local preview'}
          </span>
        </div>
      </div>
    </section>
  );
}
