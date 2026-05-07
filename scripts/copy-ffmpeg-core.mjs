#!/usr/bin/env node
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const sources = [
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
