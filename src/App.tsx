import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DownloadButton } from './components/DownloadButton';
import { DropZone } from './components/DropZone';
import { ModeToggle } from './components/ModeToggle';
import { ParameterPanel, computeHeight, type ConvertParams } from './components/ParameterPanel';
import { ProgressBar } from './components/ProgressBar';
import { convertToMonochromeGif } from './ffmpeg/convert';
import { loadFFmpeg, type FFmpegInstance } from './ffmpeg/client';
import { INPUT_WARN_BYTES, OUTPUT_WARN_BYTES } from './lib/constants';
import { estimateOutputBytes } from './lib/estimateOutput';
import { formatBytes } from './lib/format';
import { readVideoMeta, type VideoMeta } from './lib/videoMeta';
import { loadUiMode, saveUiMode, type UiMode } from './lib/uiMode';

type Pending =
  | {
      kind: 'input-size';
      bytes: number;
      onConfirm: () => void;
      onCancel: () => void;
    }
  | {
      kind: 'output-size';
      estimatedBytes: number;
      onConfirm: () => void;
      onCancel: () => void;
    };

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
  const [mode, setMode] = useState<UiMode>(() => loadUiMode());
  const [pending, setPending] = useState<Pending | null>(null);
  const ffmpegRef = useRef<FFmpegInstance | null>(null);

  useEffect(() => {
    saveUiMode(mode);
  }, [mode]);

  const handleFile = useCallback(async (file: File) => {
    try {
      const meta = await readVideoMeta(file);
      const proceed = () => {
        setState({ kind: 'params', file, meta });
        setParams({ width: meta.width, fps: 30 });
      };
      if (file.size > INPUT_WARN_BYTES) {
        setPending({
          kind: 'input-size',
          bytes: file.size,
          onConfirm: () => {
            setPending(null);
            proceed();
          },
          onCancel: () => setPending(null),
        });
        return;
      }
      proceed();
    } catch (e) {
      setState({ kind: 'error', message: errorMessage(e) });
    }
  }, []);

  const startConvert = useCallback(async () => {
    if (state.kind !== 'params') return;
    const { file, meta } = state;
    const currentParams = params;

    const runConvert = async () => {
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
    };

    const height = computeHeight(currentParams.width, meta.aspectRatio);
    const estimated = estimateOutputBytes(
      currentParams.width,
      height,
      currentParams.fps,
      meta.duration,
    );
    if (estimated > OUTPUT_WARN_BYTES) {
      setPending({
        kind: 'output-size',
        estimatedBytes: estimated,
        onConfirm: () => {
          setPending(null);
          void runConvert();
        },
        onCancel: () => setPending(null),
      });
      return;
    }

    void runConvert();
  }, [state, params]);

  const reset = useCallback(() => {
    setState({ kind: 'idle' });
  }, []);

  return (
    <main>
      <header>
        <div className="header-row">
          <h1>Monorize</h1>
          <ModeToggle value={mode} onChange={setMode} />
        </div>
        <p>動画をブラウザ内でモノクロのアニメーション GIF に変換します。動画はサーバへ送信されません。</p>
      </header>

      {state.kind === 'idle' && <DropZone onFile={handleFile} />}

      {state.kind === 'params' && (
        <>
          <p>
            選択中: <strong>{state.file.name}</strong>（{formatBytes(state.file.size)}・
            {state.meta.width}×{state.meta.height}・{state.meta.duration.toFixed(1)} 秒）
          </p>
          <ParameterPanel
            meta={state.meta}
            value={params}
            onChange={setParams}
            showUnitToggle={mode === 'advanced'}
          />
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

      <ConfirmDialog
        open={pending !== null}
        title={pendingTitle(pending)}
        message={pendingMessage(pending)}
        confirmLabel="続行"
        cancelLabel="キャンセル"
        severity="warning"
        onConfirm={() => pending?.onConfirm()}
        onCancel={() => pending?.onCancel()}
      />
    </main>
  );
}

function pendingTitle(pending: Pending | null): string {
  if (!pending) return '';
  switch (pending.kind) {
    case 'input-size':
      return '大きな動画ファイルです';
    case 'output-size':
      return '出力 GIF が大きくなる可能性があります';
  }
}

function pendingMessage(pending: Pending | null): ReactNode {
  if (!pending) return null;
  switch (pending.kind) {
    case 'input-size':
      return (
        <>
          <p>
            選択された動画は <strong>{formatBytes(pending.bytes)}</strong> あります。
            ブラウザで扱える容量はメモリ次第で、変換中にタブが落ちる可能性があります。
          </p>
          <p className="muted small">続行するか、もう少し小さなファイルを選び直してください。</p>
        </>
      );
    case 'output-size':
      return (
        <>
          <p>
            このパラメータでの出力 GIF は <strong>約 {formatBytes(pending.estimatedBytes)}</strong>{' '}
            になる見込みです。
          </p>
          <p className="muted small">
            横幅・フレームレートを下げると、出力サイズと変換時間を抑えられます。続行する場合は OK
            を押してください。
          </p>
        </>
      );
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

