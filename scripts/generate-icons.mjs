#!/usr/bin/env node
// PWA 用アイコン一式を生成する（依存ゼロ・Node 標準のみ）。
//
// 既存ブランドマーク（src/styles.css の .brand-mark）の意匠を踏襲し、
// ほぼ黒の背景に「グレースケール conic-gradient のリング」を描く。
// conic の配色はダークテーマ版 .brand-mark を採用し、暗背景での視認性を最大化する。
//
//   生成物（すべて public/ 直下）:
//     pwa-192.png / pwa-512.png        … manifest icon (purpose any)
//     maskable-512.png                 … manifest icon (purpose maskable, 安全域に縮小)
//     apple-touch-icon.png (180)       … iOS ホーム画面
//     favicon-32.png                   … favicon フォールバック
//     favicon.svg                      … SVG favicon（conic を扇形で近似）
//
// PNG は zlib.deflateSync ＋ 手書き CRC32 で IHDR/IDAT/IEND を直接書き出す。
// 再生成は `npm run icons`。

import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// ---- 配色・幾何パラメータ -------------------------------------------------

const BG = [10, 10, 10]; // #0a0a0a
const FROM_DEG = 220; // CSS の conic-gradient(from 220deg) と一致させる

// ダークテーマ .brand-mark の conic ストップ（0% と 100% は同色でラップ）。
const STOPS = [
  { p: 0.0, c: [58, 58, 62] }, // #3a3a3e
  { p: 0.35, c: [245, 245, 247] }, // #f5f5f7
  { p: 0.65, c: [245, 245, 247] }, // #f5f5f7
  { p: 1.0, c: [58, 58, 62] }, // #3a3a3e
];

const lerp = (a, b, u) => a + (b - a) * u;

// conic 位置 t∈[0,1) に対応する色を返す。
function conicColor(t) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const s0 = STOPS[i];
    const s1 = STOPS[i + 1];
    if (t >= s0.p && t <= s1.p) {
      const u = s1.p === s0.p ? 0 : (t - s0.p) / (s1.p - s0.p);
      return [lerp(s0.c[0], s1.c[0], u), lerp(s0.c[1], s1.c[1], u), lerp(s0.c[2], s1.c[2], u)];
    }
  }
  return STOPS[STOPS.length - 1].c;
}

// 中心からのベクトル (dx, dy)（y は下向き）→ conic 位置 t。
// 北を 0° とし時計回りに増加（CSS conic と同じ）。
function angleT(dx, dy) {
  let ang = (Math.atan2(dx, -dy) * 180) / Math.PI; // (-180, 180]
  ang = ((ang % 360) + 360) % 360; // [0, 360)
  return ((((ang - FROM_DEG) % 360) + 360) % 360) / 360;
}

// ---- ラスタライズ（リング on 背景、SSx SS スーパーサンプリング）---------

function renderRing(size, outerR, innerR, ss = 4) {
  const half = size / 2;
  const rgba = Buffer.alloc(size * size * 4);
  const n = ss * ss;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const dx = x + (sx + 0.5) / ss - half;
          const dy = y + (sy + 0.5) / ss - half;
          const rFrac = Math.sqrt(dx * dx + dy * dy) / half;
          if (rFrac >= innerR && rFrac <= outerR) {
            const c = conicColor(angleT(dx, dy));
            r += c[0];
            g += c[1];
            b += c[2];
          } else {
            r += BG[0];
            g += BG[1];
            b += BG[2];
          }
        }
      }
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(r / n);
      rgba[idx + 1] = Math.round(g / n);
      rgba[idx + 2] = Math.round(b / n);
      rgba[idx + 3] = 255; // 全面不透明
    }
  }
  return rgba;
}

// ---- PNG エンコード -------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10..12: compression / filter / interlace = 0
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- SVG（conic を扇形で近似）--------------------------------------------

function buildSVG() {
  const cx = 50;
  const cy = 50;
  const outerR = 0.42 * 50;
  const innerR = 0.27 * 50;
  const N = 72;
  const overlap = 0.6; // 扇形間の継ぎ目を埋める微小オーバーラップ（度）
  const pt = (ang, rad) => {
    const rd = (ang * Math.PI) / 180;
    return [(cx + rad * Math.sin(rd)).toFixed(3), (cy - rad * Math.cos(rd)).toFixed(3)];
  };
  let wedges = '';
  for (let i = 0; i < N; i++) {
    const a0 = (i * 360) / N;
    const a1 = ((i + 1) * 360) / N + overlap;
    const mid = ((i + 0.5) * 360) / N;
    const t = ((((mid - FROM_DEG) % 360) + 360) % 360) / 360;
    const [r, g, b] = conicColor(t).map((v) => Math.round(v));
    const [x1, y1] = pt(a0, outerR);
    const [x2, y2] = pt(a1, outerR);
    const [x3, y3] = pt(a1, innerR);
    const [x4, y4] = pt(a0, innerR);
    wedges +=
      `<path d="M${x1} ${y1} A${outerR} ${outerR} 0 0 1 ${x2} ${y2} ` +
      `L${x3} ${y3} A${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z" fill="rgb(${r},${g},${b})"/>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<rect width="100" height="100" rx="22" fill="#0a0a0a"/>${wedges}</svg>\n`
  );
}

// ---- 出力 -----------------------------------------------------------------

const PNG_TARGETS = [
  { file: 'pwa-192.png', size: 192, outerR: 0.42, innerR: 0.27 },
  { file: 'pwa-512.png', size: 512, outerR: 0.42, innerR: 0.27 },
  { file: 'maskable-512.png', size: 512, outerR: 0.32, innerR: 0.2 },
  { file: 'apple-touch-icon.png', size: 180, outerR: 0.42, innerR: 0.27 },
  { file: 'favicon-32.png', size: 32, outerR: 0.46, innerR: 0.28 },
];

await mkdir(publicDir, { recursive: true });

for (const t of PNG_TARGETS) {
  const png = encodePNG(t.size, renderRing(t.size, t.outerR, t.innerR));
  await writeFile(join(publicDir, t.file), png);
  console.log(`[generate-icons] ${t.file} (${t.size}x${t.size}, ${png.length} bytes)`);
}

await writeFile(join(publicDir, 'favicon.svg'), buildSVG(), 'utf8');
console.log('[generate-icons] favicon.svg');
console.log('[generate-icons] 完了');
