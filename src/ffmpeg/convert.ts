import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export interface ConvertOptions {
  ffmpeg: FFmpeg;
  file: File;
  width: number;
  height: number;
  fps: number;
}

export async function convertToMonochromeGif(opts: ConvertOptions): Promise<Blob> {
  const { ffmpeg, file, width, height, fps } = opts;
  const ext = extractExtension(file.name);
  const inputName = `input${ext}`;
  const outputName = 'output.gif';

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  try {
    const exitCode = await ffmpeg.exec([
      '-i',
      inputName,
      '-vf',
      `scale=${width}:${height},hue=s=0`,
      '-r',
      String(fps),
      outputName,
    ]);
    if (exitCode !== 0) {
      throw new Error(`ffmpeg が終了コード ${exitCode} で失敗しました`);
    }
    const data = await ffmpeg.readFile(outputName);
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    return new Blob([bytes], { type: 'image/gif' });
  } finally {
    await safeUnlink(ffmpeg, inputName);
    await safeUnlink(ffmpeg, outputName);
  }
}

function extractExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '.mp4';
}

async function safeUnlink(ffmpeg: FFmpeg, name: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    /* 既に存在しない場合は無視 */
  }
}
