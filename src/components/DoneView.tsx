import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/format';
import type { ConvertParams } from './ParameterPanel';

interface Props {
  file: File;
  blob: Blob;
  params: ConvertParams;
  onReset: () => void;
}

export function DoneView({ file, blob, params, onReset }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const downloadName = `${stripExt(file.name)}.gif`;

  return (
    <div className="panel fade-in">
      <div className="done">
        <div className="done-check" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="conv-title">変換が完了しました</h2>
          <p className="conv-sub">そのままダウンロードできます。</p>
        </div>
        <div className="done-preview">
          {url && <img src={url} alt="生成されたモノクロ GIF プレビュー" />}
        </div>
        <div className="done-stats">
          <span className="pill">
            {params.width} × {params.height}
          </span>
          <span className="pill">{params.fps} fps</span>
          <span className="pill">~{formatBytes(blob.size)}</span>
        </div>
        <div className="actions-row done-actions">
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            別の動画を変換
          </button>
          {url && (
            <a className="btn btn-primary" href={url} download={downloadName}>
              ダウンロード <span className="arr">↓</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}
