import { useEffect, useRef, type CSSProperties } from 'react';

// Seven strokes through one point, 15° apart: a burst, like light on a letterpress plate.
const strokes = [
  'M14.0014 28V0',
  'M10.3783 27.523L17.6253 0.477035',
  'M7.00137 26.1244L21.0014 1.87564',
  'M4.10156 23.8994L23.9006 4.10039',
  'M1.87578 20.9997L26.1245 6.9997',
  'M0.477148 17.6227L27.5231 10.3758',
  'M0 13.9989H28',
];

/**
 * The mark. With `spin`, hovering its link with a mouse turns each stroke half a turn about the center, one
 * after another, easing in and out. A half turn maps each stroke onto itself, so the mark ends
 * exactly where it began and nothing snaps when the animation clears.
 */
export function LogoMark({ size = 28, spin = false }: { size?: number; spin?: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const node = svg.current;
    const trigger = node?.closest('a');
    if (!spin || !node || !trigger) return;
    // Only a real mouse hover spins it: a tap on a phone fires pointerenter too, and a keyboard
    // user tabbing past shouldn't wait on decoration.
    const start = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || node.dataset.spin) return;
      node.dataset.spin = 'true';
    };
    const end = (event: AnimationEvent) => {
      if ((event.target as Element).matches('path:last-child')) delete node.dataset.spin;
    };
    trigger.addEventListener('pointerenter', start);
    node.addEventListener('animationend', end);
    return () => {
      trigger.removeEventListener('pointerenter', start);
      node.removeEventListener('animationend', end);
    };
  }, [spin]);
  return (
    <svg
      ref={svg}
      className="logo-mark"
      viewBox="0 0 28 28"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {strokes.map((d, index) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth="1.2"
          style={{ '--stroke-index': index } as CSSProperties}
        />
      ))}
    </svg>
  );
}
