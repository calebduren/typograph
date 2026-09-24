import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { typesetText } from '@calebduren/typograph';

const raw = `"It's not what you say. It's how it's set."`;

/**
 * Two stacked renderings of one line, clipped at the handle: typeset to the left, original
 * to the right. Changed glyphs share one measured width, so the layers never drift apart.
 */
export function QuoteReveal() {
  const typeset = useMemo(() => typesetText(raw, { locale: 'en' }), []);
  const changed = useMemo(
    () => [...raw].flatMap((char, index) => (char === typeset[index] ? [] : [index])),
    [typeset],
  );
  const [position, setPosition] = useState(56);
  const [widths, setWidths] = useState<Record<number, number>>({});
  const measure = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = measure.current;
    if (!node) return;
    const update = () => {
      const next: Record<number, number> = {};
      for (const span of node.querySelectorAll<HTMLElement>('[data-index]')) {
        next[Number(span.dataset.index)] = span.getBoundingClientRect().width;
      }
      setWidths(next);
    };
    update();
    // Widths change with the web font and with the fluid type size.
    document.fonts?.ready.then(update);
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const layer = (text: string, kind: 'after' | 'before') =>
    [...text].map((char, index) =>
      changed.includes(index) ? (
        <span
          key={index}
          className="reveal-glyph"
          data-kind={kind}
          style={widths[index] ? ({ width: `${widths[index]}px` } as CSSProperties) : undefined}
        >
          {char}
        </span>
      ) : (
        char
      ),
    );

  return (
    <figure className="reveal">
      <div className="reveal-stage" style={{ '--split': `${position}%` } as CSSProperties}>
        {/* Invisible copy that measures each typeset glyph's natural width. */}
        <span className="reveal-measure" ref={measure} aria-hidden="true">
          {[...typeset].map((char, index) =>
            changed.includes(index) ? (
              <span key={index} data-index={index}>
                {char}
              </span>
            ) : (
              char
            ),
          )}
        </span>
        <p className="reveal-layer reveal-after" aria-label={`Typeset: ${typeset}`}>
          <span aria-hidden="true">{layer(typeset, 'after')}</span>
        </p>
        <p className="reveal-layer reveal-before" aria-label={`Original: ${raw}`}>
          <span aria-hidden="true">{layer(raw, 'before')}</span>
        </p>
        <input
          className="reveal-input"
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={position}
          aria-label="Compare typeset and original"
          aria-valuetext={`${Math.round(position)}% typeset`}
          onChange={(event) => setPosition(Number(event.target.value))}
        />
        <span className="reveal-handle" aria-hidden="true">
          <span className="reveal-knob">
            <svg viewBox="0 0 20 20" width="14" height="14">
              <path
                d="M7 5 2 10l5 5M13 5l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </span>
        </span>
      </div>
      <figcaption className="reveal-caption">
        <span>Typeset</span>
        <span className="reveal-count">
          {changed.length} characters changed, nothing else moved
        </span>
        <span>Original</span>
      </figcaption>
    </figure>
  );
}
