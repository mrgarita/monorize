import { useCallback, useRef, useState } from 'react';
import { DownloadButton } from './components/DownloadButton';
import { DropZone } from './components/DropZone';
import { ParameterPanel, type ConvertParams } from './components/ParameterPanel';
import { ProgressBar } from './components/ProgressBar';
import { convertToMonochromeGif } from './ffmpeg/convert';
import { loadFFmpeg, type FFmpegInstance } from './ffmpeg/client';
import { readVideoMeta, type VideoMeta } from './lib/videoMeta';

type AppState =
  | { kind: 'idle' }
  | { kind: 'params'; file: File; meta: VideoMeta }
  | { kind: 'preparing'; file: File; meta: VideoMeta; params: ConvertParams }
  | { kind: 'converting'; file: File; meta: VideoMeta; params: ConvertParams; progress: number }
  | { kind: 'done'; file: File; blob: Blob }
  | { kind: 'error'; message: string };

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'idle' });
  const [params, setParams] = useState<ConvertParams>({ width: 0, fps: 30 });
  const ffmpegRef = useRef<FFmpegInstance | null>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      const meta = await readVideoMeta(file);
      setState({ kind: 'params', file, meta });
      setParams({ width: meta.width, fps: 30 });
    } catch (e) {
      setState({ kind: 'error', message: errorMessage(e) });
    }
  }, []);

  const startConvert = useCallback(async () => {
    if (state.kind !== 'params') return;
    const { file, meta } = state;
    const currentParams = params;
    setState({ kind: 'preparing', file, meta, params: currentParams });
    try {
      if (!ffmpegRef.current) {
        ffmpegRef.current = await loadFFmpeg({
          onProgress: (p) =>
            setState((s) => (s.kind === 'converting' ? { ...s, progress: p } : s)),
        });
      }
      setState({ kind: 'converting', file, meta, params: currentParams, progress: 0 });
      const blob = await convertToMonochromeGif({
        ffmpeg: ffmpegRef.current.ffmpeg,
        file,
        width: currentParams.width,
        fps: currentParams.fps,
      });
      setState({ kind: 'done', file, blob });
    } catch (e) {
      setState({ kind: 'error', message: errorMessage(e) });
    }
  }, [state, params]);

  const reset = useCallback(() => {
    setState({ kind: 'idle' });
  }, []);

  return (
    <main>
      <header>
        <h1>Monorize</h1>
        <p>動画をブラウザ内でモノクロのアニメーション GIF に変換します。動画はサーバへ送信されません。</p>
      </header>

      {state.kind === 'idle' && <DropZone onFile={handleFile} />}

      {state.kind === 'params' && (
        <>
          <p>
            選択中: <strong>{state.file.name}</strong>（{formatBytes(state.file.size)}・
            {state.meta.width}×{state.meta.height}・{state.meta.duration.toFixed(1)} 秒）
          </p>
          <ParameterPanel meta={state.meta} value={params} onChange={setParams} />
          <div className="actions">
            <button type="button" className="primary" onClick={startConvert}>
              変換を実行
            </button>
            <button type="button" onClick={reset}>
              別の動画を選ぶ
            </button>
          </div>
        </>
      )}

      {state.kind === 'preparing' && (
        <section>
          <p>
            <strong>{state.file.name}</strong> の変換準備中（ffmpeg.wasm を読み込み中）...
          </p>
          <ProgressBar progress={0} label="準備中" />
        </section>
      )}

      {state.kind === 'converting' && (
        <section>
          <p>
            <strong>{state.file.name}</strong> を変換中...
          </p>
          <ProgressBar progress={state.progress} />
        </section>
      )}

      {state.kind === 'done' && (
        <section>
          <p>変換が完了しました。</p>
          <DownloadButton blob={state.blob} filename={`${stripExt(state.file.name)}.gif`} />
          <div className="actions">
            <button type="button" onClick={reset}>
              別の動画を変換
            </button>
          </div>
        </section>
      )}

      {state.kind === 'error' && (
        <section>
          <p role="alert" className="error">エラー: {state.message}</p>
          <div className="actions">
            <button type="button" onClick={reset}>
              最初に戻る
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}
