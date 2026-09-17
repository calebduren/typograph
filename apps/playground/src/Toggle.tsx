import { useState } from 'react';

export function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
  controls,
  className = '',
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  controls?: string;
  className?: string;
}) {
  const [motion, setMotion] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-controls={controls}
      disabled={disabled}
      className={`toggle ${className}`}
      data-motion={motion ? 'on' : 'off'}
      onClick={(event) => {
        setMotion(event.detail > 0);
        onChange(!checked);
      }}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}
