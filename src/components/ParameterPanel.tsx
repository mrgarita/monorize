import { useState, type ChangeEvent } from 'react';
import { FPS_MAX, FPS_MIN, SCALE_MIN_PX } from '../lib/constants';
import type { VideoMeta } from '../lib/videoMeta';

export interface ConvertParams {
  width: number;
  height: number;
  fps: number;
}

type Unit = 'px' | 'percent';

interface Props {
  meta: VideoMeta;
  value: ConvertParams;
  onChange: (next: ConvertParams) => void;
  disabled?: boolean;
  showUnitToggle?: boolean;
}

export function ParameterPanel({ meta, value, onChange, disabled, showUnitToggle }: Props) {
  const [unit, setUnit] = useState<Unit>('px');
  const effectiveUnit: Unit = showUnitToggle ? unit : 'px';

  const maxWidth = meta.width;

  const updateWidth = (raw: number) => {
    const clamped = clamp(raw, SCALE_MIN_PX, maxWidth);
    const w = makeEven(clamped);
    onChange({ ...value, width: w, height: computeHeight(w, meta.aspectRatio) });
  };
  const updateFps = (raw: number) => {
    const clamped = clamp(raw, FPS_MIN, FPS_MAX);
    onChange({ ...value, fps: clamped });
  };

  const percentMin = Math.max(1, Math.ceil((SCALE_MIN_PX / maxWidth) * 100));
  const percentMax = 100;
  const widthDisplay =
    effectiveUnit === 'px' ? value.width : Math.round((value.width / maxWidth) * 100);
  const widthMin = effectiveUnit === 'px' ? SCALE_MIN_PX : percentMin;
  const widthMaxDisplay = effectiveUnit === 'px' ? maxWidth : percentMax;
  const widthStep = effectiveUnit === 'px' ? 2 : 1;

  const handleWidthChange = (raw: number) => {
    if (effectiveUnit === 'px') {
      updateWidth(raw);
    } else {
      const pct = clamp(raw, percentMin, percentMax);
      updateWidth(Math.round((pct / 100) * maxWidth));
    }
  };

  const onWidthInput = (e: ChangeEvent<HTMLInputElement>) =>
    handleWidthChange(Number(e.target.value));
  const onFpsInput = (e: ChangeEvent<HTMLInputElement>) => updateFps(Number(e.target.value));

  return (
    <section className="parameter-panel" aria-label="変換パラメータ">
      <h2>変換パラメータ</h2>

      <div className="field">
        <div className="field__label-row">
          <label>
            横幅:{' '}
            <strong>
              {effectiveUnit === 'px' ? `${value.width} px` : `${widthDisplay}%`}
            </strong>{' '}
            （元動画 {meta.width} px）
          </label>
          {showUnitToggle && (
            <div className="unit-toggle" role="group" aria-label="横幅の単位">
              <button
                type="button"
                className={`unit-toggle__option ${unit === 'px' ? 'is-active' : ''}`}
                aria-pressed={unit === 'px'}
                onClick={() => setUnit('px')}
                disabled={disabled}
              >
                px
              </button>
              <button
                type="button"
                className={`unit-toggle__option ${unit === 'percent' ? 'is-active' : ''}`}
                aria-pressed={unit === 'percent'}
                onClick={() => setUnit('percent')}
                disabled={disabled}
              >
                %
              </button>
            </div>
          )}
        </div>
        <input
          type="range"
          min={widthMin}
          max={widthMaxDisplay}
          step={widthStep}
          value={widthDisplay}
          onChange={onWidthInput}
          disabled={disabled}
          aria-label={effectiveUnit === 'px' ? '横幅 (px)' : '横幅 (%)'}
        />
        <input
          type="number"
          min={widthMin}
          max={widthMaxDisplay}
          step={widthStep}
          value={widthDisplay}
          onChange={onWidthInput}
          disabled={disabled}
        />
        <p className="muted small">
          実効サイズ: {value.width} × {value.height} px（縦横比ロック）
        </p>
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
