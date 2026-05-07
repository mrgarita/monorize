import { pick, randInt } from './prng.mjs';

export const RESOLUTIONS = [
  [320, 240],
  [640, 360],
  [854, 480],
  [1280, 720],
  [1920, 1080],
];

export const FPS_OPTIONS = [15, 24, 30, 60];

// mandelbrot は計算量が大きく Phase 1 直列では完走しなかったため既定では
// 除外する。Phase 3 で並列化後のスパイク評価のため、`M2B_INCLUDE_MANDELBROT=1`
// を立てると CONTENTS に追加できるトグルを設けている。
const baseContents = ['testsrc2', 'noise'];
export const CONTENTS = process.env.M2B_INCLUDE_MANDELBROT === '1'
  ? [...baseContents, 'mandelbrot']
  : baseContents;

export function generateSpec(idx, rand) {
  const [w, h] = pick(RESOLUTIONS, rand);
  return {
    idx,
    width: w,
    height: h,
    fps: pick(FPS_OPTIONS, rand),
    seconds: randInt(1, 5, rand),
    content: pick(CONTENTS, rand),
  };
}
