// ffprobe で計測した GIF メトリクスを判定する。判定基準は M2-A の
// docs/m2a-verification.md と Phase 1 の実測ログから決定済。
import { execFileSync } from 'node:child_process';
import { OUTPUT_FPS, OUTPUT_WIDTH } from './ffmpeg-runner.mjs';

export const FFPROBE = process.env.FFPROBE ?? 'D:/work/ffmpeg/ffprobe.exe';

export function probe(path) {
  const out = execFileSync(
    FFPROBE,
    [
      '-v', 'error',
      '-count_frames',
      '-show_entries', 'stream=width,height,nb_read_frames,r_frame_rate',
      '-show_entries', 'format=duration,size',
      '-of', 'default=noprint_wrappers=1',
      path,
    ],
    { encoding: 'utf8' },
  );
  const result = {};
  for (const line of out.trim().split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq);
    const v = line.slice(eq + 1);
    if (!(k in result)) result[k] = v;
  }
  return result;
}

function parseFps(rfStr) {
  if (!rfStr) return NaN;
  const parts = String(rfStr).split('/').map(Number);
  if (parts.length === 2 && parts[1]) return parts[0] / parts[1];
  return Number(rfStr);
}

export function judge(spec, gifPath) {
  const m = probe(gifPath);
  const expectedW = OUTPUT_WIDTH;
  const aspectRatio = spec.width / spec.height;
  // ffmpeg のフィルタ式 `scale=W:trunc(ow/dar/2)*2` と同ロジックで期待 H を算出
  const expectedH = Math.max(2, Math.trunc(expectedW / aspectRatio / 2) * 2);
  const expectedFrames = OUTPUT_FPS * spec.seconds;
  const expectedDuration = spec.seconds;

  const checks = [];
  let pass = true;
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    if (!ok) pass = false;
  };

  check('width', Number(m.width) === expectedW, `${m.width} (expected ${expectedW})`);
  check('height', Number(m.height) === expectedH, `${m.height} (expected ${expectedH})`);

  // GIF の r_frame_rate は近似分数（15000/1001、179/12 等）で出ることが
  // 多いため厳密一致では落ちる。実効 fps を ±0.5 fps 以内で判定する。
  const effectiveFps = parseFps(m.r_frame_rate);
  const fpsDelta = effectiveFps - OUTPUT_FPS;
  check(
    'r_frame_rate',
    Math.abs(fpsDelta) <= 0.5,
    `${m.r_frame_rate} (≈${effectiveFps.toFixed(3)} fps, Δ${fpsDelta >= 0 ? '+' : ''}${fpsDelta.toFixed(3)})`,
  );

  // 入力 fps と出力 fps の比に応じて GIF 側の frame 数が ±数フレームずれる
  // ことがある（特に高 FPS 入力からのダウンサンプル）。±5% かつ最低 ±2 を許容。
  const frameDiff = Number(m.nb_read_frames) - expectedFrames;
  const frameTol = Math.max(2, Math.ceil(expectedFrames * 0.05));
  check(
    'nb_read_frames',
    Math.abs(frameDiff) <= frameTol,
    `${m.nb_read_frames} (Δ${frameDiff >= 0 ? '+' : ''}${frameDiff} of ${expectedFrames}, tol ±${frameTol})`,
  );

  // ffmpeg は GIF 末尾に余分な 1〜2 frame を残す傾向があり、出力 duration が
  // 期待値より 0.07〜0.14 秒長く出ることが多い。短い動画ほど比率が大きく
  // なるため、絶対誤差 ±0.2 秒 か 相対 ±5% の緩い方で判定する。
  const durDelta = Number(m.duration) - expectedDuration;
  const durPct = (durDelta / expectedDuration) * 100;
  check(
    'duration',
    Math.abs(durDelta) <= 0.2 || Math.abs(durPct) <= 5,
    `${m.duration}s (Δ${durDelta >= 0 ? '+' : ''}${durDelta.toFixed(3)}s, ${durPct.toFixed(2)}%)`,
  );

  check('size', Number(m.size) > 0, `${m.size} bytes`);
  return { pass, checks, metrics: m };
}
