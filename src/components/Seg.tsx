import { useLayoutEffect, useRef, useState } from 'react';

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: SegOption<T>[];
  onChange: (next: T) => void;
  small?: boolean;
  ariaLabel?: string;
}

export function Seg<T extends string>({ value, options, onChange, small, ariaLabel }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 3, width: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const idx = options.findIndex((o) => o.value === value);
      if (idx < 0) return;
      const btn = el.querySelectorAll<HTMLButtonElement>('button[data-seg]')[idx];
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const pr = el.getBoundingClientRect();
      setPill({ left: r.left - pr.left, width: r.width });
    };

    measure();

    // Web フォントが後から swap されるとボタン幅が変わる。
    // 各ボタンの ResizeObserver で追従し pill のズレを防ぐ。
    const ro = new ResizeObserver(measure);
    el
      .querySelectorAll<HTMLButtonElement>('button[data-seg]')
      .forEach((b) => ro.observe(b));
    return () => ro.disconnect();
  }, [value, options]);

  return (
    <div
      className={`seg ${small ? 'seg-sm' : ''}`}
      ref={ref}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="pill" style={{ left: pill.left, width: pill.width }} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-seg
          className={value === o.value ? 'on' : ''}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
