import { useEffect, useMemo, useRef, useState } from 'react';
import { TypographyControls } from './TypographyControls';
import {
  charName,
  codePoint,
  runDemo,
  type Change,
  type InputKind,
  type MarkdownTarget,
  type Run,
} from './finished';
import { samples } from './finished-samples';
import type { TypographySettings } from './integration-settings';

const kinds: { value: InputKind; label: string }[] = [
  { value: 'text', label: 'Plain text' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML email' },
];
const targets: { value: MarkdownTarget; label: string }[] = [
  { value: 'web', label: 'Web HTML' },
  { value: 'email', label: 'Email HTML' },
  { value: 'markdown', label: 'Markdown' },
];
type View = 'preview' | 'changes' | 'output';

const bytes = (value: string) => new TextEncoder().encode(value).length;
const visible = (char: string) => (char === '\u00a0' ? '⍽' : char === ' ' ? '␣' : char);
const formatMs = (ms: number) => (ms < 1 ? ms.toFixed(2) : ms < 10 ? ms.toFixed(1) : ms.toFixed(0));

/** The output string with every typographic character marked, so no-break spaces are visible. */
function Output({ text }: { text: string }) {
  const parts = text.split(/([“”‘’\u00a0])/);
  return (
    <pre className="bench-output" tabIndex={0} aria-label="Package output">
      <code>
        {parts.map((part, index) =>
          index % 2 ? (
            <mark key={index} data-typograph-change={part === '\u00a0' ? 'spacing' : 'punctuation'}>
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </code>
    </pre>
  );
}

function Changes({ changes }: { changes: Change[] }) {
  if (!changes.length) {
    return <p className="bench-empty">No changes. Try adding quotes, apostrophes, or “30 min”.</p>;
  }
  return (
    <div className="bench-changes" tabIndex={0} role="region" aria-label="Changes">
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Number</span>
            </th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
            <th scope="col">Context</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change, index) => (
            <tr key={index}>
              <td className="bench-index">{index + 1}</td>
              <td>
                <span className="glyph-cell">
                  <span className="glyph" title={charName(change.before)}>
                    {visible(change.before)}
                  </span>
                  <code>{codePoint(change.before)}</code>
                </span>
              </td>
              <td>
                <span className="glyph-cell">
                  <span className="glyph after" title={charName(change.after)}>
                    {visible(change.after)}
                  </span>
                  <code>{codePoint(change.after)}</code>
                </span>
                <span className="bench-name">
                  {charName(change.after)}
                  {change.kind === 'hanging' && ', hanging'}
                </span>
              </td>
              <td className="bench-context">
                {change.context[0]}
                <mark data-typograph-change={change.kind === 'space' ? 'spacing' : 'punctuation'}>
                  {change.after}
                </mark>
                {change.context[1]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinishedDemo({
  settings,
  onSettingsChange,
}: {
  settings: TypographySettings;
  onSettingsChange: (settings: TypographySettings) => void;
}) {
  const [kind, setKind] = useState<InputKind>('markdown');
  const [target, setTarget] = useState<MarkdownTarget>('web');
  const [inputs, setInputs] = useState(() => ({
    text: samples.text.text,
    markdown: samples.markdown.text,
    html: samples.html.text,
  }));
  const [view, setView] = useState<View>('preview');
  const [run, setRun] = useState<Run>();
  const [error, setError] = useState('');
  const request = useRef(0);
  const input = inputs[kind];

  useEffect(() => {
    const id = ++request.current;
    // Typing stays responsive; the package runs once the text settles.
    const timer = window.setTimeout(
      () => {
        runDemo(input, kind, target, settings).then(
          (result) => {
            if (id !== request.current) return;
            setRun(result);
            setError('');
          },
          (reason: unknown) => {
            if (id !== request.current) return;
            setError(reason instanceof Error ? reason.message : String(reason));
          },
        );
      },
      run ? 120 : 0,
    );
    return () => window.clearTimeout(timer);
    // `run` only chooses the first delay; it must not retrigger the effect.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [input, kind, target, settings]);

  const counts = useMemo(() => {
    const tally = { quote: 0, apostrophe: 0, space: 0, hanging: 0 };
    for (const change of run?.changes ?? []) tally[change.kind]++;
    return tally;
  }, [run]);
  const summary = [
    counts.quote && `${counts.quote} quote${counts.quote === 1 ? '' : 's'}`,
    counts.apostrophe && `${counts.apostrophe} apostrophe${counts.apostrophe === 1 ? '' : 's'}`,
    counts.space && `${counts.space} no-break space${counts.space === 1 ? '' : 's'}`,
    counts.hanging && `${counts.hanging} hanging`,
  ].filter(Boolean);
  const edited = input !== samples[kind].text;

  return (
    <div className="bench" data-kind={kind}>
      <div className="bench-bar">
        <div className="segmented-control" role="group" aria-label="Input">
          {kinds.map((option) => (
            <button
              key={option.value}
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {kind === 'markdown' && (
          <div className="bench-target">
            <span aria-hidden="true">→</span>
            <div className="segmented-control" role="group" aria-label="Output">
              {targets.map((option) => (
                <button
                  key={option.value}
                  aria-pressed={target === option.value}
                  onClick={() => setTarget(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="bench-settings" role="group" aria-label="Finished text settings">
          <TypographyControls settings={settings} onSettingsChange={onSettingsChange} />
        </div>
      </div>
      <div className="bench-panes">
        <div className="bench-pane">
          <div className="pane-bar">
            <span className="file">{samples[kind].file}</span>
            <span className="pane-meta">
              {bytes(input).toLocaleString()} B
              {edited && (
                <button
                  onClick={() =>
                    setInputs((current) => ({ ...current, [kind]: samples[kind].text }))
                  }
                >
                  Reset
                </button>
              )}
            </span>
          </div>
          <textarea
            className="bench-input"
            aria-label="Input text"
            spellCheck={false}
            maxLength={20000}
            value={input}
            onChange={(event) =>
              setInputs((current) => ({ ...current, [kind]: event.target.value }))
            }
          />
        </div>
        <div className="bench-pane">
          <div className="pane-bar">
            <div className="segmented-control" role="group" aria-label="Result view">
              {(['preview', 'changes', 'output'] as const).map((value) => (
                <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>
                  {value === 'preview'
                    ? 'Preview'
                    : value === 'changes'
                      ? `Changes${run ? ` ${run.changes.length}` : ''}`
                      : 'Output'}
                </button>
              ))}
            </div>
            <span className="pane-meta">
              {run ? `${bytes(run.output).toLocaleString()} B` : ''}
            </span>
          </div>
          <div className="bench-result" data-view={view}>
            {error ? (
              <p className="bench-error" role="alert">
                {error}
              </p>
            ) : !run ? (
              <p className="bench-empty">Loading the package…</p>
            ) : view === 'preview' ? (
              <div
                className="bench-preview show-changes"
                data-kind={kind}
                tabIndex={0}
                role="region"
                aria-label="Preview"
                // Sanitized in finished.ts; the page's CSP also blocks inline scripts.
                dangerouslySetInnerHTML={{ __html: run.preview }}
              />
            ) : view === 'changes' ? (
              <Changes changes={run.changes} />
            ) : (
              <Output text={run.output} />
            )}
          </div>
        </div>
      </div>
      <div className="bench-status">
        <code className="bench-call">{run?.call ?? ' '}</code>
        <p aria-live="polite" data-testid="bench-summary">
          {run && (
            <>
              <strong>
                {run.changes.length} change{run.changes.length === 1 ? '' : 's'}
              </strong>
              {summary.length > 0 && <span>{summary.join(' · ')}</span>}
              <span>{formatMs(run.ms)} ms in this browser</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
