import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ConvertingView } from './components/ConvertingView';
import { DoneView } from './components/DoneView';
import { DropZone } from './components/DropZone';
import { ErrorView } from './components/ErrorView';
import { Footer } from './components/Footer';
import { Headline } from './components/Headline';
import { ParameterPanel, type ConvertParams } from './components/ParameterPanel';
import { TopBar } from './components/TopBar';
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
  | {
      kind: 'converting';
      file: File;
      meta: VideoMeta;
      params: ConvertParams;
      progress: number;
    }
  | { kind: 'done'; file: File; params: ConvertParams; blob: Blob }
  | { kind: 'error'; message: string };

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'idle' });
  const [params, setParams] = useState<ConvertParams>({ width: 0, height: 0, fps: 30 });
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
        setParams({ width: meta.width, height: meta.height, fps: 30 });
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
          height: currentParams.height,
          fps: currentParams.fps,
        });
        setState({ kind: 'done', file, params: currentParams, blob });
      } catch (e) {
        setState({ kind: 'error', message: errorMessage(e) });
      }
    };

    const estimated = estimateOutputBytes(
      currentParams.width,
      currentParams.height,
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
    <div className="shell">
      <TopBar mode={mode} onModeChange={setMode} />

      <main className="stage">
        <div className="card">
          {state.kind === 'idle' && <Headline />}

          {state.kind === 'idle' && <DropZone onFile={handleFile} />}

          {state.kind === 'params' && (
            <ParameterPanel
              file={state.file}
              meta={state.meta}
              value={params}
              onChange={setParams}
              advanced={mode === 'advanced'}
              onConvert={startConvert}
              onCancel={reset}
            />
          )}

          {state.kind === 'preparing' && (
            <ConvertingView
              progress={0}
              filename={state.file.name}
              sublabel="ffmpeg.wasm を読み込み中…"
            />
          )}

          {state.kind === 'converting' && (
            <ConvertingView progress={state.progress} filename={state.file.name} />
          )}

          {state.kind === 'done' && (
            <DoneView
              file={state.file}
              blob={state.blob}
              params={state.params}
              onReset={reset}
            />
          )}

          {state.kind === 'error' && (
            <ErrorView message={state.message} onReset={reset} />
          )}
        </div>
      </main>

      <Footer />

      <ConfirmDialog
        open={pending !== null}
        title={pendingTitle(pending)}
        message={pendingMessage(pending)}
        confirmLabel="続行"
        cancelLabel="キャンセル"
        onConfirm={() => pending?.onConfirm()}
        onCancel={() => pending?.onCancel()}
      />
    </div>
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
          <p className="mute">
            続行するか、もう少し小さなファイルを選び直してください。
          </p>
        </>
      );
    case 'output-size':
      return (
        <>
          <p>
            このパラメータでの出力 GIF は{' '}
            <strong>最大で約 {formatBytes(pending.estimatedBytes)}</strong>{' '}
            になる見込みです（安全側に倒した推定値で、実際はこれより小さくなる傾向があります）。
          </p>
          <p className="mute">
            横幅・フレームレートを下げると、出力サイズと変換時間を抑えられます。続行する場合は「続行」を押してください。
          </p>
        </>
      );
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
