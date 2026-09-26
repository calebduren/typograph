import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * transitions-dev “text states swap”: the old label exits up with a blur, the new one enters
 * from below. Timing reads --text-swap-dur so it stays in step with the stylesheet. Pass every
 * label the control can show as `labels` to hold its width steady.
 */
export function SwapText({ children, labels = [] }: { children: string; labels?: string[] }) {
  const [shown, setShown] = useState(children);
  const [phase, setPhase] = useState<'rest' | 'exit' | 'enter'>('rest');
  const node = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const key = labels.join('\n');

  // Reserve the widest label's width, so swapping never resizes the control around it.
  useLayoutEffect(() => {
    const box = frame.current;
    if (!box || !key) return;
    const measure = () => {
      const probe = document.createElement('span');
      const style = getComputedStyle(box);
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${style.font};letter-spacing:${style.letterSpacing};font-feature-settings:${style.fontFeatureSettings}`;
      document.body.append(probe);
      let widest = 0;
      for (const label of key.split('\n')) {
        probe.textContent = label;
        widest = Math.max(widest, probe.getBoundingClientRect().width);
      }
      probe.remove();
      box.style.minWidth = `${Math.ceil(widest)}px`;
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [key]);

  useEffect(() => {
    if (children === shown) return;
    if (reducedMotion()) {
      // oxlint-disable-next-line react/set-state-in-effect -- the label mirrors its prop
      setShown(children);
      return;
    }
    setPhase('exit');
    const duration =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-swap-dur')) ||
      200;
    const timer = window.setTimeout(() => {
      setShown(children);
      setPhase('enter');
    }, duration);
    return () => window.clearTimeout(timer);
  }, [children, shown]);

  useLayoutEffect(() => {
    if (phase !== 'enter') return;
    // Force a reflow at the “below” position so returning to rest transitions.
    void node.current?.offsetHeight;
    // oxlint-disable-next-line react/set-state-in-effect -- the third phase of the swap
    setPhase('rest');
  }, [phase]);

  const state = phase === 'exit' ? ' is-exit' : phase === 'enter' ? ' is-enter-start' : '';
  return (
    <span ref={frame} className="t-text-swap-frame">
      <span ref={node} className={`t-text-swap${state}`}>
        {shown}
      </span>
    </span>
  );
}
