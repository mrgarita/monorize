import { FFmpeg } from '@ffmpeg/ffmpeg';
import { detectThreadingMode, resolveCorePaths, type ThreadingMode } from './threading';

export interface LoadOptions {
  baseUrl?: string;
  onLog?: (line: string) => void;
  onProgress?: (progress: number) => void;
}

export interface FFmpegInstance {
  ffmpeg: FFmpeg;
  mode: ThreadingMode;
}

export async function loadFFmpeg(opts: LoadOptions = {}): Promise<FFmpegInstance> {
  const baseUrl = opts.baseUrl ?? import.meta.env.BASE_URL;
  const mode = detectThreadingMode();
  const paths = resolveCorePaths(mode, baseUrl);

  const ffmpeg = new FFmpeg();
  if (opts.onLog) {
    ffmpeg.on('log', ({ message }) => opts.onLog!(message));
  }
  if (opts.onProgress) {
    ffmpeg.on('progress', ({ progress }) => opts.onProgress!(progress));
  }

  // 絶対 URL に正規化する。Vite dev サーバは相対 URL の dynamic import を
  // `?import` クエリ付きで自分の middleware に流し込み、public/ 配下のファイルは
  // import 禁止として弾く。絶対 URL（http(s)://...）にすると Vite は外部 URL とみなして
  // transform を素通しするので、ブラウザがそのまま public/ から fetch できる。
  const loadConfig: Parameters<FFmpeg['load']>[0] = {
    coreURL: toAbsoluteURL(paths.coreURL),
    wasmURL: toAbsoluteURL(paths.wasmURL),
  };
  if (paths.workerURL) {
    loadConfig.workerURL = toAbsoluteURL(paths.workerURL);
  }

  await ffmpeg.load(loadConfig);
  return { ffmpeg, mode };
}

function toAbsoluteURL(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (typeof location === 'undefined') return url;
  return new URL(url, location.origin).href;
}
