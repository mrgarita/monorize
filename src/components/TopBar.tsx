import { Brand } from './Brand';
import { Seg } from './Seg';
import type { UiMode } from '../lib/uiMode';

interface Props {
  mode: UiMode;
  onModeChange: (next: UiMode) => void;
}

export function TopBar({ mode, onModeChange }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <Brand />
        <div className="topbar-right">
          <span className="topbar-meta" aria-hidden="true">
            <span className="pip" />
            <span>処理はブラウザ内で完結</span>
          </span>
          <Seg<UiMode>
            value={mode}
            options={[
              { value: 'simple', label: 'シンプル' },
              { value: 'advanced', label: '詳細' },
            ]}
            onChange={onModeChange}
            small
            ariaLabel="表示モード"
          />
        </div>
      </div>
    </header>
  );
}
