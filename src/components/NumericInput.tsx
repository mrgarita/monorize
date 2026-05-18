import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (next: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  unit?: string;
}

const NOTICE_DURATION_MS = 2500;

export function NumericInput({
  value,
  min,
  max,
  step = 1,
  onCommit,
  disabled,
  ariaLabel,
  id,
  unit,
}: Props) {
  const [text, setText] = useState(() => String(value));
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // フォーカス外のとき、外部から value が変わったら表示を同期する。
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current !== undefined) clearTimeout(noticeTimer.current);
    };
  }, []);

  const clearNotice = () => {
    if (noticeTimer.current !== undefined) {
      clearTimeout(noticeTimer.current);
      noticeTimer.current = undefined;
    }
    setNotice(null);
  };

  const showNotice = (msg: string) => {
    if (noticeTimer.current !== undefined) clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
  };

  const commit = () => {
    setEditing(false);
    if (text.trim() === '') {
      setText(String(value));
      return;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setText(String(value));
      return;
    }

    const rounded = Math.round(parsed);
    const clamped = Math.max(min, Math.min(max, rounded));
    let aligned = step > 0 ? min + Math.round((clamped - min) / step) * step : clamped;
    if (aligned > max) {
      aligned = min + Math.floor((max - min) / Math.max(step, 1)) * Math.max(step, 1);
    }
    if (aligned < min) aligned = min;

    if (aligned !== parsed) {
      if (parsed < min) {
        showNotice(`最小値 ${min} に調整しました`);
      } else if (parsed > max) {
        showNotice(`最大値 ${max} に調整しました`);
      } else {
        showNotice(`${aligned} に調整しました`);
      }
    }

    if (aligned !== value) {
      onCommit(aligned);
    } else {
      setText(String(aligned));
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setEditing(true);
    clearNotice();
    e.target.select();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setText(String(value));
      setEditing(false);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onCommit(Math.max(min, Math.min(max, value + step)));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onCommit(Math.max(min, Math.min(max, value - step)));
    }
  };

  const width = `${Math.max(2, String(text || '').length)}ch`;

  return (
    <div className="num-wrap">
      <span className="num">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-valuemin={min}
          aria-valuemax={max}
          value={text}
          style={{ width }}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
        />
        {unit && <span className="u">{unit}</span>}
      </span>
      <p
        className={`num-notice ${notice ? 'show' : ''}`}
        role="status"
        aria-live="polite"
      >
        {notice || ' '}
      </p>
    </div>
  );
}
