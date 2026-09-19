import { useRef, type CSSProperties } from 'react';

/** Native range behavior with a separate, lightly elastic visual track. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  valueText,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  valueText?: string;
  onChange: (value: number) => void;
}) {
  const visual = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ pointerId: number; left: number; width: number } | null>(null);
  const progress = Math.max(0, Math.min(1, (value - min) / (max - min)));

  function release() {
    drag.current = null;
    if (visual.current) {
      visual.current.removeAttribute('data-dragging');
      visual.current.style.transform = '';
    }
  }

  return (
    <span
      className="slider"
      data-disabled={disabled}
      style={{ '--slider-progress': `${progress * 100}%` } as CSSProperties}
    >
      <input
        type="range"
        aria-label={label}
        aria-valuetext={valueText}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          const { left, width } = event.currentTarget.getBoundingClientRect();
          drag.current = { pointerId: event.pointerId, left, width };
          event.currentTarget.setPointerCapture(event.pointerId);
          if (visual.current) visual.current.dataset.dragging = 'true';
        }}
        onPointerMove={(event) => {
          const bounds = drag.current;
          if (!bounds || bounds.pointerId !== event.pointerId || !visual.current) return;
          const x = event.clientX - bounds.left;
          const beyond = x < 0 ? x : Math.max(0, x - bounds.width);
          const stretch = Math.min(12, Math.abs(beyond) * 0.15);
          visual.current.style.transformOrigin = beyond < 0 ? 'right center' : 'left center';
          visual.current.style.transform = `scaleX(${1 + stretch / bounds.width})`;
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      />
      <span ref={visual} className="slider-visual" aria-hidden="true">
        <span className="slider-track">
          <span className="slider-fill" />
        </span>
      </span>
    </span>
  );
}
