// ネイティブ ffmpeg バイナリの呼び出しを集約。lavfi で合成入力を作り、
// ブラウザ側 src/ffmpeg/convert.ts と同じフィルタチェーンで GIF を出力する。
import { execFileSync } from 'node:child_process';

export const FFMPEG = process.env.FFMPEG ?? 'D:/work/ffmpeg/ffmpeg.exe';

// ハーネスの目的は判定機構と並列スケーラビリティの確認なので、出力幅は
// 640 固定にして中間ファイル容量と所要時間を現実的に抑える。ブラウザ側は
// ユーザーが任意幅を選べる。
export const OUTPUT_WIDTH = 640;
export const OUTPUT_FPS = 15;

export function buildLavfi(spec) {
  const { width, height, fps, seconds, content } = spec;
  if (content === 'testsrc2') {
    return `testsrc2=size=${width}x${height}:rate=${fps}:duration=${seconds}`;
  }
  if (content === 'mandelbrot') {
    return `mandelbrot=size=${width}x${height}:rate=${fps}:end_pts=${seconds}`;
  }
  // noise: 灰色背景 + 全プレーン時間ノイズ
  return (
    `color=c=gray:size=${width}x${height}:rate=${fps}:duration=${seconds},` +
    `format=yuv420p,noise=alls=80:allf=t`
  );
}

export function generateInput(spec, inputPath) {
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', buildLavfi(spec),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-movflags', '+faststart',
      inputPath,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
}

export function convertToGif(_spec, inputPath, outputPath) {
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-loglevel', 'error',
      '-i', inputPath,
      '-vf', `scale=${OUTPUT_WIDTH}:trunc(ow/dar/2)*2,hue=s=0`,
      '-r', String(OUTPUT_FPS),
      outputPath,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
}
