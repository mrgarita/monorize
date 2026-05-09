#!/usr/bin/env node
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// FFMPEG_ST_ONLY=1 のとき core-mt のコピーをスキップして既存ディレクトリも削除する。
// GitHub Pages デプロイは COOP/COEP を設定できず crossOriginIsolated にならないため
// mt 版は使えず、配信容量を抑える目的で CI 側でこの環境変数を渡す。
const stOnly = process.env.FFMPEG_ST_ONLY === '1';

const allSources = [
  {
    label: 'core (single-thread)',
    from: join(repoRoot, 'node_modules/@ffmpeg/core/dist/esm'),
    to: join(repoRoot, 'public/ffmpeg/core'),
    files: ['ffmpeg-core.js', 'ffmpeg-core.wasm'],
  },
  {
    label: 'core-mt (multi-thread)',
    from: join(repoRoot, 'node_modules/@ffmpeg/core-mt/dist/esm'),
    to: join(repoRoot, 'public/ffmpeg/core-mt'),
    files: ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js'],
  },
];

const sources = stOnly ? allSources.filter((src) => !src.to.endsWith('core-mt')) : allSources;

if (stOnly) {
  const mtDir = join(repoRoot, 'public/ffmpeg/core-mt');
  await rm(mtDir, { recursive: true, force: true });
  console.log(`[copy-ffmpeg-core] FFMPEG_ST_ONLY=1: core-mt を除外し ${mtDir} を削除しました`);
}

for (const src of sources) {
  if (!existsSync(src.from)) {
    console.error(`[copy-ffmpeg-core] 元ディレクトリが見つかりません: ${src.from}`);
    console.error('npm install を先に実行してください。');
    process.exit(1);
  }
  await rm(src.to, { recursive: true, force: true });
  await mkdir(src.to, { recursive: true });
  for (const file of src.files) {
    const source = join(src.from, file);
    const dest = join(src.to, file);
    if (!existsSync(source)) {
      console.error(`[copy-ffmpeg-core] ファイルが見つかりません: ${source}`);
      process.exit(1);
    }
    await cp(source, dest);
  }
  console.log(`[copy-ffmpeg-core] ${src.label}: ${src.files.length} files copied to ${src.to}`);
}
