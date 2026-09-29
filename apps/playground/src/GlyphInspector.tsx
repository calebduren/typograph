import { useEffect, useRef, useState } from 'react';
import { codePoint } from './glyphs';

/*
  A type designer's inspector over a heading: the glyph under the pointer turns to outline, sits
  in its advance box with the font's cap, x-height, baseline, and descender guides, and is
  labeled with its code point and Unicode name. The heading itself stays real, kerned text; this
  layer only measures it. Nothing moves until someone hovers: it is there to be found.
*/

type Metrics = {
  descent: number;
  ascender: number;
  cap: number;
  xHeight: number;
  descender: number;
};
type Glyph = {
  char: string;
  left: number;
  top: number;
  width: number;
  height: number;
  baseline: number;
  lineLeft: number;
  lineWidth: number;
};

const punctuation: Record<string, string> = {
  ',': 'comma',
  '.': 'full stop',
  '’': 'right single quotation mark',
  "'": 'apostrophe',
};

function glyphName(char: string) {
  if (/[A-Z]/.test(char)) return `Latin capital letter ${char}`;
  if (/[a-z]/.test(char)) return `Latin small letter ${char}`;
  return punctuation[char] ?? '';
}

/** Every visible character in the heading, as a one-character Range, in reading order. */
function characterRanges(root: HTMLElement, skip: Element) {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      skip.contains(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) continue;
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      ranges.push(range);
    }
  }
  return ranges;
}

function measureMetrics(root: HTMLElement): Metrics {
  const style = getComputedStyle(root);
  const context = document.createElement('canvas').getContext('2d')!;
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return {
    descent: context.measureText('H').fontBoundingBoxDescent,
    ascender: context.measureText('dhl').actualBoundingBoxAscent,
    cap: context.measureText('H').actualBoundingBoxAscent,
    xHeight: context.measureText('x').actualBoundingBoxAscent,
    descender: context.measureText('p').actualBoundingBoxDescent,
  };
}

export function GlyphInspector() {
  const layer = useRef<HTMLSpanElement>(null);
  const [glyph, setGlyph] = useState<Glyph>();
  const [metrics, setMetrics] = useState<Metrics>();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const overlay = layer.current;
    const root = overlay?.parentElement;
    if (!overlay || !root) return;
    let ranges: Range[] = [];
    let current: Range | undefined;
    let fontMetrics = measureMetrics(root);

    const refresh = () => {
      ranges = characterRanges(root, overlay);
      fontMetrics = measureMetrics(root);
      setMetrics(fontMetrics);
    };

    const place = (range: Range) => {
      current = range;
      const box = root.getBoundingClientRect();
      // The pinned hero scales as it recedes; convert to the heading's own pixels.
      const scale = box.width / root.offsetWidth || 1;
      const rect = range.getBoundingClientRect();
      const line = ranges.filter(
        (other) => Math.abs(other.getBoundingClientRect().top - rect.top) < 1,
      );
      const first = line[0]?.getBoundingClientRect() ?? rect;
      const last = line.at(-1)?.getBoundingClientRect() ?? rect;
      const top = (rect.top - box.top) / scale;
      const height = rect.height / scale;
      setGlyph({
        char: range.toString(),
        left: (rect.left - box.left) / scale,
        top,
        width: rect.width / scale,
        height,
        // The range covers the font's content area, so the baseline sits one descent above it.
        baseline: top + height - fontMetrics.descent,
        lineLeft: (first.left - box.left) / scale,
        lineWidth: (last.right - first.left) / scale,
      });
      setShown(true);
    };

    const hide = () => {
      current = undefined;
      setShown(false);
    };

    const hit = (x: number, y: number) =>
      ranges.find((range) => {
        const rect = range.getBoundingClientRect();
        return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
      });

    const onMove = (event: PointerEvent) => {
      const range = hit(event.clientX, event.clientY);
      if (range === current) return;
      if (range) place(range);
      else hide();
    };
    const onLeave = hide;

    refresh();
    document.fonts?.ready.then(refresh);
    const resize = new ResizeObserver(() => {
      refresh();
      if (current) place(current);
    });
    resize.observe(root);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerdown', onMove);
    root.addEventListener('pointerleave', onLeave);
    return () => {
      resize.disconnect();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerdown', onMove);
      root.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  const guides = glyph &&
    metrics && [
      { name: 'cap height', y: glyph.baseline - metrics.cap },
      { name: 'x-height', y: glyph.baseline - metrics.xHeight },
      { name: 'baseline', y: glyph.baseline },
      { name: 'descender', y: glyph.baseline + metrics.descender },
    ];

  // The frame spans ascender to descender, the glyph's working height, not the whole em box.
  const frameTop = glyph && metrics ? glyph.baseline - Math.max(metrics.ascender, metrics.cap) : 0;
  const frameHeight =
    glyph && metrics ? Math.max(metrics.ascender, metrics.cap) + metrics.descender : 0;

  return (
    <span
      ref={layer}
      className="glyph-inspector"
      data-shown={shown || undefined}
      aria-hidden="true"
    >
      {glyph && guides && (
        <>
          <span
            className="gi-guides"
            style={{
              left: glyph.lineLeft,
              width: glyph.lineWidth,
              top: glyph.top,
              height: glyph.height,
              // The guides fade out from the inspected glyph.
              ['--gi-x' as string]: `${glyph.left + glyph.width / 2 - glyph.lineLeft}px`,
            }}
          >
            {guides.map((guide) => (
              <span key={guide.name} className="gi-guide" style={{ top: guide.y - glyph.top }} />
            ))}
          </span>
          <span className="gi-tags" style={{ left: glyph.lineLeft, top: glyph.top }}>
            {guides.map((guide) => (
              <span key={guide.name} style={{ top: guide.y - glyph.top }}>
                {guide.name}
              </span>
            ))}
          </span>
          <span
            className="gi-frame"
            style={{
              transform: `translate(${glyph.left}px, ${frameTop}px)`,
              width: glyph.width,
              height: frameHeight,
            }}
          >
            <span
              className="gi-glyph"
              style={{ top: glyph.top - frameTop, lineHeight: `${glyph.height}px` }}
            >
              {glyph.char}
            </span>
            <span className="gi-label">
              <b>{codePoint(glyph.char)}</b>
              <span>{glyphName(glyph.char)}</span>
            </span>
          </span>
        </>
      )}
    </span>
  );
}
