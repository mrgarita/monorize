interface Props {
  progress: number;
  filename: string;
  sublabel?: string;
}

export function ConvertingView({ progress, filename, sublabel }: Props) {
  const r = 62;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = Math.round(clamped * 100);
  const off = c * (1 - clamped);
  return (
    <div className="panel fade-in">
      <div className="conv">
        <div className="conv-orbit">
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle className="ring" cx="70" cy="70" r={r} />
            <circle
              className="prog"
              cx="70"
              cy="70"
              r={r}
              strokeDasharray={c}
              strokeDashoffset={off}
            />
          </svg>
          <div className="pct" aria-live="polite">
            {pct}
            <span className="u">%</span>
          </div>
        </div>
        <div>
          <h2 className="conv-title">変換しています</h2>
          <p className="conv-sub">{sublabel ?? `${filename} をモノクロGIFへ`}</p>
        </div>
        <div className="filmstrip" aria-hidden="true">
          <div className="filmstrip-track">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className={i < 8 ? 'frame color' : 'frame'}
                style={{ ['--h' as string]: String(30 + i * 22) }}
              />
            ))}
          </div>
        </div>
        <div className="conv-meta">
          <span>ffmpeg.wasm</span>
          <span className="dot" />
          <span>ローカル処理</span>
          <span className="dot" />
          <span>送信なし</span>
        </div>
      </div>
    </div>
  );
}
