import type { UiMode } from '../lib/uiMode';

interface Props {
  value: UiMode;
  onChange: (next: UiMode) => void;
}

export function ModeToggle({ value, onChange }: Props) {
  return (
    <div className="mode-toggle" role="group" aria-label="表示モード">
      <button
        type="button"
        className={`mode-toggle__option ${value === 'simple' ? 'is-active' : ''}`}
        aria-pressed={value === 'simple'}
        onClick={() => onChange('simple')}
      >
        シンプル
      </button>
      <button
        type="button"
        className={`mode-toggle__option ${value === 'advanced' ? 'is-active' : ''}`}
        aria-pressed={value === 'advanced'}
        onClick={() => onChange('advanced')}
      >
        詳細
      </button>
    </div>
  );
}
