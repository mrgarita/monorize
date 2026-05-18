import type { ChangeEvent } from 'react';

interface Props {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Slider({ min, max, step = 1, value, onChange, disabled, ariaLabel }: Props) {
  const denom = Math.max(1, max - min);
  const raw = (value - min) / denom;
  const p = Math.max(0, Math.min(1, raw));
  const onInput = (e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value));
  return (
    <div
      className="slider"
      style={{ ['--p' as string]: String(p) }}
    >
      <div className="slider-track">
        <div className="slider-fill" />
      </div>
      <div className="slider-thumb" aria-hidden="true" />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onInput}
        disabled={disabled}
        aria-label={ariaLabel}
      />
    </div>
  );
}
