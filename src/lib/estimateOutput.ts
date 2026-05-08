/**
 * GIF 出力サイズの経験的補正係数。
 * sample/ 6 本の実測 bytes/(W*H*fps*duration) は 0.071〜0.284。
 * 0.30 で全 sample を上回り、警告判定は誤検出側（過大評価寄り）に倒れる。
 */
export const EPSILON = 0.3;

export function estimateOutputBytes(
  width: number,
  height: number,
  fps: number,
  durationSec: number,
): number {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(fps) ||
    !Number.isFinite(durationSec)
  ) {
    return 0;
  }
  return Math.round(width * height * fps * durationSec * EPSILON);
}
