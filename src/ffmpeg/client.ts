import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
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

  const loadConfig: Parameters<FFmpeg['load']>[0] = {
    coreURL: await toBlobURL(paths.coreURL, 'text/javascript'),
    wasmURL: await toBlobURL(paths.wasmURL, 'application/wasm'),
  };
  if (paths.workerURL) {
    loadConfig.workerURL = await toBlobURL(paths.workerURL, 'text/javascript');
  }

  await ffmpeg.load(loadConfig);
  return { ffmpeg, mode };
}
