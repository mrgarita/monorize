import type { ChangeEvent } from 'react';
import { FPS_MAX, FPS_MIN, SCALE_MIN_PX } from '../lib/constants';
import type { VideoMeta } from '../lib/videoMeta';

export interface ConvertParams {
  width: number;
  fps: number;
}

interface Props {
  meta: VideoMeta;
  value: ConvertParams;
  onChange: (next: ConvertParams) => void;
  disabled?: boolean;
}

export function ParameterPanel({ meta, value, onChange, disabled }: Props) {
  const height = computeHeight(value.width, meta.aspectRatio);
  const maxWidth = meta.width;

  const updateWidth = (raw: number) => {
    const clamped = clamp(raw, SCALE_MIN_PX, maxWidth);
    onChange({ ...value, width: makeEven(clamped) });
  };
  const updateFps = (raw: number) => {
    const clamped = clamp(raw, FPS_MIN, FPS_MAX);
    onChange({ ...value, fps: clamped });
  };

  const onWidthInput = (e: ChangeEvent<HTMLInputElement>) => updateWidth(Number(e.target.value));
  const onFpsInput = (e: ChangeEvent<HTMLInputElement>) => updateFps(Number(e.target.value));

  return (
    <section className="parameter-panel" aria-label="変換パラメータ">
      <h2>変換パラメータ</h2>

      <div className="field">
        <label>
          横幅: <strong>{value.width} px</strong> （元動画 {meta.width} px）
        </label>
        <input
          type="range"
          min={SCALE_MIN_PX}
          max={maxWidth}
          value={value.width}
          onChange={onWidthInput}
          disabled={disabled}
          aria-label="横幅 (px)"
        />
        <input
          type="number"
          min={SCALE_MIN_PX}
          max={maxWidth}
          step={2}
          value={value.width}
          onChange={onWidthInput}
          disabled={disabled}
        />
        <p className="muted small">高さ: {height} px（縦横比ロック）</p>
      </div>

      <div className="field">
        <label>
          フレームレート: <strong>{value.fps} fps</strong>
        </label>
        <input
          type="range"
          min={FPS_MIN}
          max={FPS_MAX}
          value={value.fps}
          onChange={onFpsInput}
          disabled={disabled}
          aria-label="フレームレート (fps)"
        />
        <input
          type="number"
          min={FPS_MIN}
          max={FPS_MAX}
          value={value.fps}
          onChange={onFpsInput}
          disabled={disabled}
        />
      </div>
    </section>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function makeEven(n: number): number {
  return n % 2 === 0 ? n : n - 1;
}

export function computeHeight(width: number, aspectRatio: number): number {
  if (!aspectRatio || !Number.isFinite(aspectRatio)) return 0;
  return makeEven(Math.max(2, Math.round(width / aspectRatio)));
}
