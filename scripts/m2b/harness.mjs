#!/usr/bin/env node
// M2-B Phase 2: ネイティブ ffmpeg + Worker threads で N=10,000 規模の
// ハーネスを並列実行する。直列版の挙動と判定基準は Phase 1
// （旧 scripts/m2b-harness.mjs）から据え置き。
//
// 実行例:
//   npm run m2b:harness               # N=10000、CPU コア数で並列
//   npm run m2b:harness -- 42         # seed=42
//   N=100 npm run m2b:harness         # 動作確認用に件数を絞る
//   M2B_WORKERS=4 npm run m2b:harness # 並行数を上書き
import { appendFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { FFMPEG } from './ffmpeg-runner.mjs';
import { FFPROBE } from './probe.mjs';
import { mulberry32 } from './prng.mjs';
import { generateSpec } from './spec.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const WORK_DIR = join(repoRoot, 'tmp/m2b');

const N = Number(process.env.N ?? 10000);
const SEED = Number(process.argv[2] ?? process.env.SEED ?? 1);
// N < WORKERS のときに余ったワーカーがメッセージ受信を待ったまま終了しない
// バグを避けるため、ジョブ件数を上限としてプールサイズを縮める。
const WORKERS = Math.max(1, Math.min(N, Number(process.env.M2B_WORKERS ?? cpus().length)));

if (!existsSync(FFMPEG)) die(`ffmpeg がありません: ${FFMPEG}`);
if (!existsSync(FFPROBE)) die(`ffprobe がありません: ${FFPROBE}`);
mkdirSync(WORK_DIR, { recursive: true });

console.log(`[m2b] seed=${SEED} N=${N} workers=${WORKERS} work=${WORK_DIR}`);

// 全 spec を先に生成する（PRNG 順序の決定性を確保）。
// shift の O(n) を避けるため index で消費する。
const rand = mulberry32(SEED);
const specs = Array.from({ length: N }, (_, i) => generateSpec(i + 1, rand));
let nextJob = 0;

const workerURL = new URL('./worker.mjs', import.meta.url);
const workers = Array.from({ length: WORKERS }, () => new Worker(workerURL));

let pass = 0;
let fail = 0;
let completed = 0;
const t0 = Date.now();
let nextLog = t0 + 1000;

// 全件の所要時間をサンプル収集（pass / fail 両方）し、最後にパーセンタイル
// を計算する。N=10,000 で要素 30,000 個 × 8 byte ≒ 240KB なので問題ない。
const timings = { tGen: [], tConv: [], total: [] };

// 失敗詳細は最初の fail 発生時にファイルを作る（fail=0 ならファイル無し）。
// ファイル名は seed と起動時刻でユニークに。
const failureTs = new Date().toISOString().replace(/[:.]/g, '-');
const failureLogPath = join(WORK_DIR, `failures-s${SEED}-${failureTs}.jsonl`);
let failureLogStarted = false;

function dispatch(worker) {
  if (nextJob >= specs.length) return false;
  const spec = specs[nextJob++];
  const idxLabel = String(spec.idx).padStart(5, '0');
  const inputPath = join(WORK_DIR, `input-${idxLabel}-s${SEED}.mp4`);
  const outputPath = join(WORK_DIR, `output-${idxLabel}-s${SEED}.gif`);
  worker.postMessage({ spec, inputPath, outputPath });
  return true;
}

await new Promise((resolve) => {
  let active = workers.length;
  for (const worker of workers) {
    worker.on('message', (msg) => {
      completed++;
      timings.tGen.push(msg.tGen);
      timings.tConv.push(msg.tConv);
      timings.total.push(msg.total);

      if (msg.result.pass) {
        pass++;
        safeUnlink(msg.inputPath);
        safeUnlink(msg.outputPath);
      } else {
        fail++;
        const failedChecks = (msg.result.checks ?? [])
          .filter((c) => !c.ok)
          .map(({ name, detail }) => ({ name, detail }));
        const reasons = msg.result.error
          ? `error: ${msg.result.error}`
          : failedChecks.map((c) => `${c.name}: ${c.detail}`).join('; ');
        console.log(
          `[FAIL] idx=${msg.idx} ${msg.spec.width}x${msg.spec.height} ` +
            `fps=${msg.spec.fps} sec=${msg.spec.seconds} ${msg.spec.content} | ${reasons}`,
        );
        appendFailure({
          idx: msg.idx,
          spec: msg.spec,
          tGen: msg.tGen,
          tConv: msg.tConv,
          total: msg.total,
          inputPath: msg.inputPath,
          outputPath: msg.outputPath,
          error: msg.result.error ?? null,
          failedChecks,
        });
      }
      if (Date.now() >= nextLog || completed === N) {
        printProgress();
        nextLog = Date.now() + 1000;
      }
      if (!dispatch(worker)) {
        worker.terminate();
        active--;
        if (active === 0) resolve();
      }
    });
    worker.on('error', (e) => {
      console.error('[m2b] worker error:', e);
    });
  }
  for (const worker of workers) dispatch(worker);
});

const elapsed = (Date.now() - t0) / 1000;
console.log(
  `=== summary: ${pass}/${N} pass, ${fail} fail (${formatTime(elapsed)}, rate=${(completed / elapsed).toFixed(1)}/s) ===`,
);
printTimings('tGen', timings.tGen);
printTimings('tConv', timings.tConv);
printTimings('total', timings.total);
if (failureLogStarted) {
  console.log(`[m2b] failures: ${failureLogPath} (${fail} 件)`);
}
process.exit(fail === 0 ? 0 : 1);

function printTimings(label, values) {
  if (values.length === 0) return;
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  console.log(
    `[m2b] timings(ms): ${label.padEnd(5)} ` +
      `min=${sorted[0]} p50=${pct(0.5)} p90=${pct(0.9)} p99=${pct(0.99)} max=${sorted[sorted.length - 1]}`,
  );
}

function appendFailure(record) {
  if (!failureLogStarted) {
    failureLogStarted = true;
    console.log(`[m2b] failures will be written to ${failureLogPath}`);
  }
  appendFileSync(failureLogPath, `${JSON.stringify(record)}\n`);
}

function printProgress() {
  const elapsed = (Date.now() - t0) / 1000;
  const rate = elapsed > 0 ? completed / elapsed : 0;
  const remaining = N - completed;
  const eta = rate > 0 ? remaining / rate : 0;
  const pct = ((completed / N) * 100).toFixed(1);
  console.log(
    `[m2b] ${completed}/${N} (${pct}%) pass=${pass} fail=${fail} ` +
      `elapsed=${formatTime(elapsed)} eta=${formatTime(eta)} rate=${rate.toFixed(1)}/s`,
  );
}

function formatTime(seconds) {
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(0)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m < 60) return `${m}m${String(sec).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}h${String(min).padStart(2, '0')}m${String(sec).padStart(2, '0')}s`;
}

function safeUnlink(path) {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    /* 失敗しても続行 */
  }
}

function die(msg) {
  console.error(`[m2b] ${msg}`);
  process.exit(1);
}
