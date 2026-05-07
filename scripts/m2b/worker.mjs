// Worker thread のエントリポイント。1 件の spec を受け取り、合成入力生成
// → GIF 変換 → 判定 を行ってメインに結果を返す。
import { parentPort } from 'node:worker_threads';
import { convertToGif, generateInput } from './ffmpeg-runner.mjs';
import { judge } from './probe.mjs';

if (!parentPort) {
  throw new Error('worker.mjs は worker_threads 経由でのみ起動できます');
}

parentPort.on('message', (job) => {
  const { spec, inputPath, outputPath } = job;
  const t0 = Date.now();
  let result;
  let tGen = 0;
  let tConv = 0;
  try {
    const t1 = Date.now();
    generateInput(spec, inputPath);
    tGen = Date.now() - t1;
    const t2 = Date.now();
    convertToGif(spec, inputPath, outputPath);
    tConv = Date.now() - t2;
    result = judge(spec, outputPath);
  } catch (e) {
    result = { pass: false, error: stringifyError(e) };
  }
  parentPort.postMessage({
    idx: spec.idx,
    spec,
    result,
    tGen,
    tConv,
    total: Date.now() - t0,
    inputPath,
    outputPath,
  });
});

function stringifyError(e) {
  if (!e) return String(e);
  const stderr = e.stderr ? String(e.stderr).trim() : '';
  const msg = e.message ?? String(e);
  return stderr ? `${msg} | stderr: ${stderr}` : msg;
}
