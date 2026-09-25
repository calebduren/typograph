import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { typesetText } from '@calebduren/typograph';

const question = "Can you recap today's launch for the team?";
const reply = `Here's the recap: "Atlas" shipped at 9 a.m., and it's already 30 % faster than last week's build. Dr. Chen's note says it best: "Ship it, then tell everyone."`;

// Split like a model would: short, uneven tokens, so quotes arrive before their words.
const tokens = reply.match(/\s*[^\s"]{1,4}|\s*"/g) ?? [reply];
const stream = { locale: 'en', spacing: true, phase: 'streaming' } as const;
const settled = { locale: 'en', spacing: true } as const;

/** Render typeset text, marking every character the package changed. */
function marked(raw: string, typeset: string, on: boolean): ReactNode[] {
  const parts: ReactNode[] = [];
  let plain = '';
  for (let i = 0; i < raw.length; i++) {
    if (on && typeset[i] !== raw[i]) {
      if (plain) parts.push(<Fragment key={`t${i}`}>{plain}</Fragment>);
      plain = '';
      parts.push(
        <mark key={i} className="flip" data-space={typeset[i] === '\u00a0' || undefined}>
          {typeset[i]}
        </mark>,
      );
    } else {
      plain += on ? typeset[i] : raw[i];
    }
  }
  if (plain) parts.push(<Fragment key="end">{plain}</Fragment>);
  return parts;
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

function Card({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={`float-card ${className}`} aria-hidden="true">
      {children}
    </div>
  );
}

export function HeroScene() {
  const reduced = useReducedMotion();
  const [streamed, setCount] = useState(0);
  const [on, setOn] = useState(true);
  const scene = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const node = scene.current;
    if (!node || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    // Stream, hold the finished reply, then start over.
    const delay = streamed >= tokens.length ? 4200 : streamed === 0 ? 700 : 38 + (streamed % 5) * 9;
    const timer = window.setTimeout(
      () => setCount((current) => (current >= tokens.length ? 0 : current + 1)),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [streamed, reduced, visible]);

  // Reduced motion shows the finished reply without streaming.
  const count = reduced ? tokens.length : streamed;
  const raw = tokens.slice(0, count).join('');
  const done = count >= tokens.length;
  const typeset = typesetText(raw, done ? settled : stream);

  const final = useMemo(() => typesetText(reply, settled), []);
  const cards = useMemo(
    () => ({
      notification: typesetText(`Your brief is ready: "Q3 review" takes 12 min.`, settled),
      subject: typesetText(`Re: "Atlas" launch — it's live`, settled),
      preview: typesetText(`Sam's summary is below. We'll ship at 9 a.m.`, settled),
    }),
    [],
  );

  return (
    <div className="scene" ref={scene}>
      <Card className="card-notification">
        <span className="app-icon">“</span>
        <span className="card-lines">
          <span className="card-title">
            Assistant <em>now</em>
          </span>
          <span>{cards.notification}</span>
        </span>
      </Card>
      <Card className="card-email">
        <span className="card-kicker">Inbox</span>
        <span className="card-title">{cards.subject}</span>
        <span className="card-body">{cards.preview}</span>
      </Card>
      <Card className="card-code">
        <code>
          <span className="code-from">'</span>
          <span className="code-arrow">→</span>
          <span className="code-to">’</span>
        </code>
        <span>U+2019</span>
      </Card>

      <div className="window" role="group" aria-label="Streaming assistant reply">
        <div className="window-bar">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="window-title">Assistant</span>
          <button
            className="typograph-switch"
            role="switch"
            aria-checked={on}
            aria-label="Typograph"
            onClick={() => setOn(!on)}
          >
            <span className="switch-dot" aria-hidden="true" />
            Typograph
          </button>
        </div>
        <div className="window-body">
          <p className="bubble bubble-user">{question}</p>
          <div className="bubble bubble-ai">
            <span className="sr-only">{final}</span>
            <span className="bubble-sizer" aria-hidden="true">
              {final}
            </span>
            <span aria-hidden="true">
              {marked(raw, typeset, on)}
              {!done && <span className="caret" />}
            </span>
          </div>
        </div>
        <div className="window-foot" aria-hidden="true">
          <code>
            typesetText(reply, {'{'} locale: 'en', phase: '{done ? 'complete' : 'streaming'}' {'}'})
          </code>
        </div>
      </div>
    </div>
  );
}
