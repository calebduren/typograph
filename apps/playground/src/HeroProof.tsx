import { useMemo, useState } from 'react';
import { typesetText } from '@calebduren/typograph';
import { charName, codePoint } from './glyphs';

const raw = `"It's ready in 30 min."`;
const options = { locale: 'en', spacing: true } as const;
const NBSP = String.fromCharCode(0xa0);

/** The package runs here, on load; nothing below is pre-rendered. */
function measure() {
  const output = typesetText(raw, options);
  // One call is faster than the browser's timer resolution, so time batches of calls.
  const batches: number[] = [];
  for (let batch = 0; batch < 9; batch++) {
    const start = performance.now();
    for (let i = 0; i < 100; i++) typesetText(raw, options);
    batches.push((performance.now() - start) / 100);
  }
  batches.sort((a, b) => a - b);
  const changes = [...raw].flatMap((char, index) => (char === output[index] ? [] : [index]));
  return { output, changes, microseconds: batches[4] * 1000 };
}

export function HeroProof() {
  const [original, setOriginal] = useState(false);
  const { output, changes, microseconds } = useMemo(() => measure(), []);
  const shown = original ? raw : output;

  const glyph = (index: number) => {
    const n = changes.indexOf(index) + 1;
    if (!n) return shown[index];
    if (output[index] === NBSP) {
      // The swatch clips its own content, so the number lives on the wrapper.
      return (
        <span className="proof-mark" data-kind="spacing" data-n={n} key={index}>
          <span className="proof-space">{NBSP}</span>
        </span>
      );
    }
    return (
      <span className="proof-mark" data-n={n} key={index}>
        {shown[index]}
      </span>
    );
  };

  return (
    <figure className="proof" aria-label="Live specimen" data-original={original}>
      <figcaption className="proof-call">
        <span className="proof-prompt" aria-hidden="true">
          ›
        </span>
        <code>
          typesetText(<span className="token-string">{`\`${raw}\``}</span>, {'{ '}
          locale: <span className="token-string">'en'</span>, spacing:{' '}
          <span className="token-keyword">true</span>
          {' })'}
        </code>
      </figcaption>
      <p className="proof-line" aria-label={shown}>
        <span aria-hidden="true">
          {/* The opening quote hangs outside the text edge, as the optional helper does. */}
          <span className="proof-hang">{glyph(0)}</span>
          {[...shown].slice(1).map((_, offset) => glyph(offset + 1))}
        </span>
      </p>
      <ol className="proof-legend">
        {changes.map((index, n) => (
          <li key={index}>
            <span className="proof-n">{n + 1}</span>
            {output[index] === NBSP ? (
              <span className="proof-glyph" data-kind="spacing" />
            ) : (
              <span className="proof-glyph">{output[index]}</span>
            )}
            <code>{codePoint(output[index])}</code>
            <span>{charName(output[index])}</span>
          </li>
        ))}
      </ol>
      <div className="proof-foot">
        <p>
          {changes.length} changes in{' '}
          <span className="proof-ms">{microseconds.toFixed(microseconds < 10 ? 1 : 0)} µs</span> per
          call, timed in your browser.
        </p>
        <button
          className="proof-toggle"
          aria-pressed={original}
          onClick={() => setOriginal(!original)}
        >
          {original ? 'Show typeset' : 'Show original'}
        </button>
      </div>
    </figure>
  );
}
