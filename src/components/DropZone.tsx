import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { ACCEPTED_ACCEPT_ATTR, ACCEPTED_EXTENSIONS } from '../lib/constants';

interface Props {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: Props) {
  const [isOver, setIsOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const lowerName = file.name.toLowerCase();
      const dot = lowerName.lastIndexOf('.');
      const ext = dot >= 0 ? lowerName.slice(dot) : '';
      if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
        setError(`対応していない拡張子です: ${ext || '(なし)'}`);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile],
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    handleFile(e.dataTransfer.files[0]);
  };
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  return (
    <div className="panel">
      <div
        className={`drop ${isOver ? 'over' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-label="動画ファイルのドロップ領域"
      >
        <div className="drop-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </div>
        <div>
          <p className="drop-title">動画ファイルをドロップ</p>
          <p className="drop-sub">または、下のボタンから選択してください。</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => inputRef.current?.click()}
        >
          ファイルを選択
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_ACCEPT_ATTR}
          hidden
          onChange={onInputChange}
        />
        <p className="drop-formats">{ACCEPTED_EXTENSIONS.join('  ·  ')}</p>

        <div className="drop-warn">
          <svg
            className="ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <span>
            スマホなど RAM の少ない端末では、長尺・高解像度の動画でタブが強制再読み込みされる場合があります。まずは数十秒程度の短めの動画でお試しください。
          </span>
        </div>

        {error && (
          <p role="alert" className="drop-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
