#!/usr/bin/env node
// M2-B Phase 1: ネイティブ ffmpeg バイナリで合成動画を生成 → モノクロ GIF
// に変換 → ffprobe で品質判定、を直列で N 件回す単体ハーネス。
// 並列化と 10,000 件規模対応は Phase 2 へ。
// 実行: `npm run m2b:harness` または `npm run m2b:harness -- <seed>`
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const FFMPEG = process.env.FFMPEG ?? 'D:/work/ffmpeg/ffmpeg.exe';
const FFPROBE = process.env.FFPROBE ?? 'D:/work/ffmpeg/ffprobe.exe';
const WORK_DIR = join(repoRoot, 'tmp/m2b');
const N = Number(process.env.N ?? 20);
const SEED = Number(process.argv[2] ?? process.env.SEED ?? 1);
const OUTPUT_FPS = 15;
// テスト時間と中間ファイル量を現実的に抑えるため、出力幅は 640 固定にする。
// ブラウザ側ではユーザーが任意の幅を選べるが、Phase 1 のハーネスは判定機構と
// 並列スケーラビリティの確認が目的で、解像度の網羅は不要。
const OUTPUT_WIDTH = 640;
const VERBOSE = process.env.M2B_VERBOSE === '1';

if (!existsSync(FFMPEG)) die(`ffmpeg がありません: ${FFMPEG}`);
if (!existsSync(FFPROBE)) die(`ffprobe がありません: ${FFPROBE}`);
mkdirSync(WORK_DIR, { recursive: true });

// ---- mulberry32 PRNG（同一 seed で再現性確保） -----------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

// ---- 仕様生成 --------------------------------------------------------------
const RESOLUTIONS = [
  [320, 240],
  [640, 360],
  [854, 480],
  [1280, 720],
  [1920, 1080],
];
const FPS_OPTIONS = [15, 24, 30, 60];
// mandelbrot は計算量が大きく N=20 を分単位で完走できないため除外（Phase 2
// で Worker threads 並列化したあとに再評価する）。
const CONTENTS = ['testsrc2', 'noise'];

function generateSpec(idx) {
  const [w, h] = pick(RESOLUTIONS);
  return {
    idx,
    width: w,
    height: h,
    fps: pick(FPS_OPTIONS),
    // 1〜5 秒。N=20 を分単位で完走させたいので長すぎない範囲にする。
    seconds: randInt(1, 5),
    content: pick(CONTENTS),
  };
}

// ---- 入力動画の生成 (lavfi で合成) -----------------------------------------
function buildLavfi(spec) {
  const { width, height, fps, seconds, content } = spec;
  if (content === 'testsrc2') {
    return `testsrc2=size=${width}x${height}:rate=${fps}:duration=${seconds}`;
  }
  if (content === 'mandelbrot') {
    // mandelbrot は内部時計で進む。end_pts に指定秒を入れて打ち切る。
    return `mandelbrot=size=${width}x${height}:rate=${fps}:end_pts=${seconds}`;
  }
  // noise: 灰色背景に時間ノイズを乗せる
  return `color=c=gray:size=${width}x${height}:rate=${fps}:duration=${seconds},format=yuv420p,noise=alls=80:allf=t`;
}

function generateInput(spec, inputPath) {
  const lavfi = buildLavfi(spec);
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', lavfi,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      '-movflags', '+faststart',
      inputPath,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
}

// ---- GIF 変換（ブラウザ実装と同フィルタ） ---------------------------------
function convertToGif(spec, inputPath, outputPath) {
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

// ---- ffprobe で計測 -------------------------------------------------------
function probe(path) {
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

const makeEven = (n) => (n % 2 === 0 ? n : n - 1);

function parseFps(rfStr) {
  if (!rfStr) return NaN;
  const parts = String(rfStr).split('/').map(Number);
  if (parts.length === 2 && parts[1]) return parts[0] / parts[1];
  return Number(rfStr);
}

function judge(spec, gifPath) {
  const m = probe(gifPath);
  const expectedW = OUTPUT_WIDTH;
  const aspectRatio = spec.width / spec.height;
  // ffmpeg のフィルタ式 `scale=W:trunc(ow/dar/2)*2` と完全に同じロジックで
  // 期待 height を算出する（trunc は切り捨て、その後 2 倍で偶数化）。
  // src 側 ParameterPanel.computeHeight は round + makeEven で計算しており
  // 値が 1 ピクセルずれることがあるが、ハーネスの判定は ffmpeg 側に揃える。
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

  // GIF の r_frame_rate は近似分数（15000/1001 や 179/12 等）で出ることが
  // 多いため厳密一致では落ちる。実効 fps を ±0.5 fps 以内で判定する。
  const effectiveFps = parseFps(m.r_frame_rate);
  const fpsDelta = effectiveFps - OUTPUT_FPS;
  check(
    'r_frame_rate',
    Math.abs(fpsDelta) <= 0.5,
    `${m.r_frame_rate} (≈${effectiveFps.toFixed(3)} fps, Δ${fpsDelta >= 0 ? '+' : ''}${fpsDelta.toFixed(3)})`,
  );

  // 入力 fps と出力 fps の比に応じて GIF 側の frame 数が ±数フレームずれる
  // ことがある（特に高 FPS 入力からのダウンサンプル）。±5% かつ最低 ±2 を許容する。
  const frameDiff = Number(m.nb_read_frames) - expectedFrames;
  const frameTol = Math.max(2, Math.ceil(expectedFrames * 0.05));
  check(
    'nb_read_frames',
    Math.abs(frameDiff) <= frameTol,
    `${m.nb_read_frames} (Δ${frameDiff >= 0 ? '+' : ''}${frameDiff} of ${expectedFrames}, tol ±${frameTol})`,
  );

  // ffmpeg は GIF 末尾に余分な 1〜2 frame を残す傾向があり、出力 duration が
  // 期待値より 0.07〜0.14 秒（at 15fps で 1〜2 frame 分）長く出ることが多い。
  // 短い動画ほど比率が大きくなるため、絶対誤差 ±0.2 秒 か 相対 ±5% の
  // 緩い方で判定する。
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

// ---- メインループ ---------------------------------------------------------
console.log(`[m2b] seed=${SEED} N=${N} work=${WORK_DIR}`);
let pass = 0;
let fail = 0;
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  const spec = generateSpec(i + 1);
  const idxLabel = String(spec.idx).padStart(3, '0');
  const inputPath = join(WORK_DIR, `input-${idxLabel}-s${SEED}.mp4`);
  const outputPath = join(WORK_DIR, `output-${idxLabel}-s${SEED}.gif`);

  const tag = `[${String(i + 1).padStart(2, '0')}/${N}]`;
  const meta = `${spec.width}x${spec.height} fps=${spec.fps} sec=${String(spec.seconds).padStart(2)} ${spec.content.padEnd(11)}`;
  if (VERBOSE) console.log(`${tag} start ${meta}`);

  let result;
  let tGen = 0;
  let tConv = 0;
  try {
    const t1 = Date.now();
    generateInput(spec, inputPath);
    tGen = Date.now() - t1;
    if (VERBOSE) console.log(`${tag}   gen ${(tGen / 1000).toFixed(1)}s`);
    const t2 = Date.now();
    convertToGif(spec, inputPath, outputPath);
    tConv = Date.now() - t2;
    if (VERBOSE) console.log(`${tag}   conv ${(tConv / 1000).toFixed(1)}s`);
    result = judge(spec, outputPath);
  } catch (e) {
    result = { pass: false, error: stringifyError(e) };
  }

  const timing = `[gen ${(tGen / 1000).toFixed(1)}s + conv ${(tConv / 1000).toFixed(1)}s]`;

  if (result.pass) {
    pass++;
    const m = result.metrics;
    console.log(
      `${tag} pass  ${meta} -> frames=${m.nb_read_frames} dur=${m.duration}s size=${m.size} ${timing}`,
    );
    safeUnlink(inputPath);
    safeUnlink(outputPath);
  } else {
    fail++;
    console.log(`${tag} FAIL  ${meta} ${timing}`);
    if (result.error) {
      console.log(`        error: ${result.error}`);
    } else {
      for (const c of result.checks) {
        if (!c.ok) console.log(`        ${c.name}: ${c.detail}`);
      }
    }
    console.log(`        kept: ${inputPath} ${outputPath}`);
  }
}

const elapsed = (Date.now() - t0) / 1000;
console.log(`=== summary: ${pass}/${N} pass, ${fail} fail (${elapsed.toFixed(1)}s) ===`);
process.exit(fail === 0 ? 0 : 1);

// ---- helpers --------------------------------------------------------------
function safeUnlink(path) {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* 失敗しても続行 */
  }
}

function stringifyError(e) {
  if (!e) return String(e);
  // execFileSync が投げる例外には stderr がぶら下がっていることが多い
  const stderr = e.stderr ? String(e.stderr).trim() : '';
  const msg = e.message ?? String(e);
  return stderr ? `${msg} | stderr: ${stderr}` : msg;
}

function die(msg) {
  console.error(`[m2b] ${msg}`);
  process.exit(1);
}
