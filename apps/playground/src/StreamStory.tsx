import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { typesetText } from '@calebduren/typograph';
import { Kern } from './Kern';
import { LogoMark } from './LogoMark';

const reply = `Here's the launch note for Friday's all-hands:

"Atlas" ships Friday morning. It's twice as fast as last year's build, 40 MB lighter, and opens a 300-page doc in under 2 s.

"We didn't set out to build the fastest editor," Dr. Chen said in Monday's review. "We set out to build the one you'd trust with a sentence that says 'final.'"

Rollout takes about 30 min per region. If you're on the beta, you'll see it tonight. There's nothing to install, and nothing you've written will change.`;

// Split like a model would: short, uneven tokens, so quotes arrive before their words.
const tokens = reply.match(/\n\n|[ ]?[^\s"]{1,4}|[ ]?"/g) ?? [reply];
const ends = tokens.reduce<number[]>(
  (all, token) => [...all, (all.at(-1) ?? 0) + token.length],
  [],
);
const streaming = { locale: 'en', spacing: true, phase: 'streaming' } as const;
const settled = { locale: 'en', spacing: true } as const;

type Side = 'raw' | 'typeset';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * One token's markup: changed characters are wrapped, everything else is plain text. An opening
 * quote that starts a paragraph hangs in the margin, using the package's hanging classes.
 */
function tokenHtml(raw: string, typeset: string, side: Side, opensParagraph: boolean) {
  let html = '';
  for (let i = 0; i < raw.length; i++) {
    const char = side === 'raw' ? raw[i] : typeset[i];
    let glyph = escape(char);
    if (raw[i] !== typeset[i]) {
      const space = typeset[i] === ' ' ? ' m-space' : '';
      glyph = `<mark class="m-${side}${space}">${glyph}</mark>`;
    }
    if (side === 'typeset' && opensParagraph && i === 0 && (char === '“' || char === '‘')) {
      glyph = `<span class="typograph-opening"><span>${glyph}</span></span>`;
    }
    html += glyph;
  }
  return html;
}

/**
 * Renders a prefix of the reply into one column without React, so a scroll frame only touches
 * the tokens whose output changed. Earlier tokens can change too: a quote the streaming phase
 * held back settles once the characters after it arrive.
 */
class StreamView {
  private paragraphs: HTMLParagraphElement[] = [];
  private spans: (HTMLSpanElement | null)[] = [];
  private keys: string[] = [];

  constructor(
    private root: HTMLElement,
    private side: Side,
  ) {}

  render(count: number, output: string) {
    let paragraph = 0;
    let opens = true;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '\n\n') {
        paragraph++;
        opens = true;
        continue;
      }
      const opensParagraph = opens;
      opens = false;
      if (i >= count) {
        this.spans[i]?.remove();
        this.spans[i] = null;
        this.keys[i] = '';
        continue;
      }
      let p = this.paragraphs[paragraph];
      if (!p) p = this.paragraphs[paragraph] = document.createElement('p');
      if (!p.isConnected) this.root.append(p);
      const slice = output.slice(ends[i] - token.length, ends[i]);
      let span = this.spans[i];
      if (!span) {
        span = this.spans[i] = document.createElement('span');
        span.className = 'stream-token';
        p.append(span);
      }
      if (this.keys[i] !== slice) {
        this.keys[i] = slice;
        span.innerHTML = tokenHtml(token, slice, this.side, opensParagraph);
      }
    }
    for (const p of this.paragraphs) if (!p.firstChild) p.remove();
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query?.addEventListener('change', update);
    return () => query?.removeEventListener('change', update);
  }, []);
  return reduced;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// Streaming starts as the columns come into view, and most of it happens while they are still
// moving up the page. The columns then pin for this share of the stream to finish it.
const pinnedShare = 0.2;

/**
 * The hero, then a two-column stream whose pace is the reader's scroll. The hero stays pinned
 * and recedes (zoom, blur, fade) as the columns rise over it; each scroll frame eases toward a
 * token count, so a fast flick streams fast and a pause stops the model mid-sentence.
 */
export function StreamStory({ hero }: { hero: ReactNode }) {
  const reduced = useReducedMotion();
  const story = useRef<HTMLDivElement>(null);
  const heroLayer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const columns = useRef<HTMLDivElement>(null);
  const rawRoot = useRef<HTMLDivElement>(null);
  const typesetRoot = useRef<HTMLDivElement>(null);
  const rawSizer = useRef<HTMLDivElement>(null);
  const typesetSizer = useRef<HTMLDivElement>(null);

  // Every prefix a token boundary can produce, typeset once. The last one is complete.
  const outputs = useMemo(
    () =>
      ends.map((end, index) =>
        typesetText(reply.slice(0, end), index === ends.length - 1 ? settled : streaming),
      ),
    [],
  );
  const final = outputs.at(-1)!;

  useEffect(() => {
    // Invisible finished copies reserve each column's height, so streaming never shifts layout.
    new StreamView(rawSizer.current!, 'raw').render(tokens.length, final);
    new StreamView(typesetSizer.current!, 'typeset').render(tokens.length, final);
    const raw = new StreamView(rawRoot.current!, 'raw');
    const typeset = new StreamView(typesetRoot.current!, 'typeset');
    let shown = -1;
    const paint = (count: number) => {
      if (count === shown) return;
      shown = count;
      const output = outputs[count - 1] ?? '';
      raw.render(count, output);
      typeset.render(count, output);
    };

    if (reduced) {
      paint(tokens.length);
      heroLayer.current?.removeAttribute('style');
      columns.current?.removeAttribute('style');
      track.current?.style.removeProperty('height');
      stage.current?.style.removeProperty('top');
      return;
    }

    // Geometry: where the stage pins, and how much scroll the whole stream takes.
    let pinTop = 0;
    let span = 1;
    const measure = () => {
      const viewport = window.innerHeight;
      const header = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
      const height = stage.current!.offsetHeight;
      // Pin below the header, or, for a stage taller than the viewport, once its end is in view.
      pinTop = Math.min(header + 24, viewport - height - 24);
      const moving = viewport - pinTop;
      const pinned = (moving * pinnedShare) / (1 - pinnedShare);
      span = moving + pinned;
      stage.current!.style.top = `${pinTop}px`;
      track.current!.style.height = `${height + pinned}px`;
    };
    measure();

    let frame = 0;
    let running = false;
    let last = 0;
    let eased = -1;

    const tick = (now: number) => {
      frame = 0;
      const node = track.current;
      if (!node) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      const top = node.getBoundingClientRect().top;
      const viewport = window.innerHeight;

      // The hero recedes while the stream rises to where it pins.
      const enter = clamp((viewport - top) / Math.max(1, viewport - pinTop));
      const hero = heroLayer.current;
      if (hero) {
        const e = enter * enter * (3 - 2 * enter);
        hero.style.transform = `scale(${1 + e * 0.16})`;
        hero.style.filter = e > 0.002 ? `blur(${(e * 18).toFixed(2)}px)` : '';
        hero.style.opacity = String(1 - e * 0.94);
        hero.style.visibility = e > 0.999 ? 'hidden' : '';
      }
      // The columns scale up into place as they arrive.
      const grid = columns.current;
      if (grid) {
        const e = 1 - (1 - enter) ** 3;
        grid.style.transform = e < 1 ? `scale(${(0.9 + e * 0.1).toFixed(4)})` : '';
        grid.style.opacity = String(0.35 + e * 0.65);
      }

      // Scroll distance maps to tokens, eased so text flows rather than jumps.
      const target = clamp((viewport - top) / span) * tokens.length;
      if (eased < 0) eased = target;
      eased += (target - eased) * (1 - Math.exp(-dt / 0.12));
      if (Math.abs(target - eased) < 0.02) eased = target;
      paint(Math.min(tokens.length, Math.floor(eased + 0.001)));

      if (running) frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(([entry]) =>
      entry.isIntersecting ? start() : stop(),
    );
    observer.observe(story.current!);
    const resize = new ResizeObserver(measure);
    resize.observe(stage.current!);
    window.addEventListener('resize', measure);
    return () => {
      stop();
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [outputs, final, reduced]);

  const column = (side: Side, label: ReactNode) => (
    <article className="stream-column" data-side={side}>
      <p className="stream-label">{label}</p>
      <div className="stream-text">
        <div className="stream-reply stream-sizer" ref={side === 'raw' ? rawSizer : typesetSizer} />
        <div className="stream-reply stream-live" ref={side === 'raw' ? rawRoot : typesetRoot} />
      </div>
    </article>
  );

  return (
    <div className="story" ref={story} data-reduced={reduced || undefined}>
      <div className="story-hero" ref={heroLayer}>
        {hero}
      </div>
      <section id="stream" className="stream-track" ref={track} aria-labelledby="stream-title">
        <div className="stream-stage" ref={stage}>
          <h2 id="stream-title" className="sr-only">
            A streamed reply, before and after
          </h2>
          <p className="sr-only">
            A reply streams into two columns as you scroll: on the left as the model sent it, on the
            right through Typograph. The finished Typograph version reads: {final}
          </p>
          <div className="stream-columns" ref={columns} aria-hidden="true">
            {column('raw', 'Model output')}
            {column(
              'typeset',
              <span className="stream-logo">
                <LogoMark size={18} />
                <Kern>typograph</Kern>
              </span>,
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
