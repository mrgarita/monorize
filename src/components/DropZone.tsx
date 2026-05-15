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
    <section
      className={`dropzone ${isOver ? 'is-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label="動画ファイルのドロップ領域"
    >
      <p>動画ファイルをここにドラッグ&amp;ドロップ</p>
      <p className="muted">または</p>
      <button type="button" onClick={() => inputRef.current?.click()}>
        ファイルを選択
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_ACCEPT_ATTR}
        hidden
        onChange={onInputChange}
      />
      <p className="muted small">
        対応形式: {ACCEPTED_EXTENSIONS.join(', ')}
      </p>
      <p className="dropzone__notice">
        スマホなど RAM の少ない端末では、長尺・高解像度の動画でタブが強制再読み込みされる場合があります。
        <br />
        まずは数十秒程度の短めの動画でお試しください。
      </p>
      {error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}
