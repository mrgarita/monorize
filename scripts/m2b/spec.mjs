import { pick, randInt } from './prng.mjs';

export const RESOLUTIONS = [
  [320, 240],
  [640, 360],
  [854, 480],
  [1280, 720],
  [1920, 1080],
];

export const FPS_OPTIONS = [15, 24, 30, 60];

// mandelbrot は計算量が大きく Phase 1 直列で完走しなかったため除外。
// 並列化後の Phase 3 で再評価する。
export const CONTENTS = ['testsrc2', 'noise'];

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
