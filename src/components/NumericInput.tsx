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
}: Props) {
  const [text, setText] = useState(() => String(value));
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // フォーカス外のとき、外部から value が変わったら表示を同期する。
  // 編集中は上書きせず、入力途中の値を保持させる。
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
    if (text.trim() === '') return;
    const parsed = Number(text);
    if (Number.isNaN(parsed)) return;

    const rounded = Math.round(parsed);
    const clamped = Math.max(min, Math.min(max, rounded));
    let aligned = step > 0 ? min + Math.round((clamped - min) / step) * step : clamped;
    // step 揃えで max を超える可能性（max が step 境界に乗らない場合）に備えて
    // 直近の境界へ落とす
    if (aligned > max) aligned = min + Math.floor((max - min) / Math.max(step, 1)) * Math.max(step, 1);
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
    }
    // value が変わらない場合でも、useEffect が editing 変化を検知して
    // text を String(value) に整形し直す（"32.0" → "32" 等）。
  };

  const handleFocus = () => {
    setEditing(true);
    clearNotice();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  return (
    <>
      <input
        id={id}
        // type="number" だと Android Chrome が inputMode を無視して小数点付き
        // キーボードを出す。type="text" + inputMode="tel" + pattern で
        // iOS/Android 双方で「.」を含まないテンキーを安定して出す。
        // （inputMode="numeric" は Gboard が「.」「-」を混ぜたレイアウトを
        // 出してしまうため、整数のみ入力したい欄では tel を使うのが定石）
        type="text"
        inputMode="tel"
        pattern="[0-9]*"
        autoComplete="off"
        className="numeric-input"
        aria-valuemin={min}
        aria-valuemax={max}
        value={text}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      {notice && (
        <p className="numeric-input__notice small" role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </>
  );
}
