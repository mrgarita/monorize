import { useEffect, useState, type ChangeEvent } from 'react';
import { FPS_MAX, FPS_MIN, SCALE_MIN_PX } from '../lib/constants';
import type { VideoMeta } from '../lib/videoMeta';
import { NumericInput } from './NumericInput';

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
  advanced?: boolean;
}

export function ParameterPanel({ meta, value, onChange, disabled, advanced }: Props) {
  const [unit, setUnit] = useState<Unit>('px');
  const [lockAspect, setLockAspect] = useState(true);
  const effectiveUnit: Unit = advanced ? unit : 'px';
  const effectiveLock = advanced ? lockAspect : true;

  // シンプルモードに戻った時、詳細モードで個別指定にしていた残り値（縦横比が
  // 崩れた height）を縦横比どおりに揃え直す。advanced=true のあいだは編集
  // ロジックが整合性を維持するので、補正が必要なのは advanced=false のみ。
  useEffect(() => {
    if (advanced) return;
    const expectedHeight = computeHeight(value.width, meta.aspectRatio);
    if (value.height !== expectedHeight) {
      onChange({ ...value, height: expectedHeight });
    }
    // value.height / onChange は補正トリガとして含めない（無限ループ回避）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanced, value.width, meta.aspectRatio]);

  const maxWidth = meta.width;
  const maxHeight = meta.height;

  const setSize = (rawWidth: number, rawHeight: number) => {
    const w = makeEven(clamp(rawWidth, SCALE_MIN_PX, maxWidth));
    const h = makeEven(clamp(rawHeight, SCALE_MIN_PX, maxHeight));
    onChange({ ...value, width: w, height: h });
  };

  const updateWidth = (raw: number) => {
    const w = makeEven(clamp(raw, SCALE_MIN_PX, maxWidth));
    if (effectiveLock) {
      const h = computeHeight(w, meta.aspectRatio);
      onChange({ ...value, width: w, height: h });
    } else {
      onChange({ ...value, width: w });
    }
  };

  const updateHeight = (raw: number) => {
    const h = makeEven(clamp(raw, SCALE_MIN_PX, maxHeight));
    if (effectiveLock) {
      const w = computeWidth(h, meta.aspectRatio);
      onChange({ ...value, width: w, height: h });
    } else {
      onChange({ ...value, height: h });
    }
  };

  const updateFps = (raw: number) => {
    const clamped = clamp(raw, FPS_MIN, FPS_MAX);
    onChange({ ...value, fps: clamped });
  };

  // 横幅: 表示値・min・max・step
  const widthPercentMin = Math.max(1, Math.ceil((SCALE_MIN_PX / maxWidth) * 100));
  const widthDisplay =
    effectiveUnit === 'px' ? value.width : Math.round((value.width / maxWidth) * 100);
  const widthMin = effectiveUnit === 'px' ? SCALE_MIN_PX : widthPercentMin;
  const widthMaxDisplay = effectiveUnit === 'px' ? maxWidth : 100;
  const widthStep = effectiveUnit === 'px' ? 2 : 1;

  // 縦幅: 表示値・min・max・step
  const heightPercentMin = Math.max(1, Math.ceil((SCALE_MIN_PX / maxHeight) * 100));
  const heightDisplay =
    effectiveUnit === 'px' ? value.height : Math.round((value.height / maxHeight) * 100);
  const heightMin = effectiveUnit === 'px' ? SCALE_MIN_PX : heightPercentMin;
  const heightMaxDisplay = effectiveUnit === 'px' ? maxHeight : 100;
  const heightStep = effectiveUnit === 'px' ? 2 : 1;

  const handleWidthChange = (raw: number) => {
    if (effectiveUnit === 'px') {
      updateWidth(raw);
    } else {
      const pct = clamp(raw, widthPercentMin, 100);
      updateWidth(Math.round((pct / 100) * maxWidth));
    }
  };

  const handleHeightChange = (raw: number) => {
    if (effectiveUnit === 'px') {
      updateHeight(raw);
    } else {
      const pct = clamp(raw, heightPercentMin, 100);
      updateHeight(Math.round((pct / 100) * maxHeight));
    }
  };

  const onWidthInput = (e: ChangeEvent<HTMLInputElement>) =>
    handleWidthChange(Number(e.target.value));
  const onHeightInput = (e: ChangeEvent<HTMLInputElement>) =>
    handleHeightChange(Number(e.target.value));
  const onFpsInput = (e: ChangeEvent<HTMLInputElement>) => updateFps(Number(e.target.value));

  // ロック OFF → ON に戻したときに、現在の縦横比を強制的に元動画比へ揃える。
  // ロック ON のあいだは編集ロジックが連動更新するので不変条件は維持される。
  const handleLockChange = (next: boolean) => {
    setLockAspect(next);
    if (next) {
      // 現在の width を基準に height を縦横比どおりに再計算
      setSize(value.width, computeHeight(value.width, meta.aspectRatio));
    }
  };

  return (
    <section className="parameter-panel" aria-label="変換パラメータ">
      <h2>変換パラメータ</h2>

      {advanced && (
        <div className="panel-controls">
          <div className="lock-toggle" role="group" aria-label="縦横比">
            <button
              type="button"
              className={`lock-toggle__option ${lockAspect ? 'is-active' : ''}`}
              aria-pressed={lockAspect}
              onClick={() => handleLockChange(true)}
              disabled={disabled}
            >
              縦横比ロック
            </button>
            <button
              type="button"
              className={`lock-toggle__option ${!lockAspect ? 'is-active' : ''}`}
              aria-pressed={!lockAspect}
              onClick={() => handleLockChange(false)}
              disabled={disabled}
            >
              個別指定
            </button>
          </div>
          <div className="unit-toggle" role="group" aria-label="サイズの単位">
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
        </div>
      )}

      <div className="field">
        <label>
          横幅:{' '}
          <strong>
            {effectiveUnit === 'px' ? `${value.width} px` : `${widthDisplay}%`}
          </strong>{' '}
          （元動画 {meta.width} px）
        </label>
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
        <NumericInput
          value={widthDisplay}
          min={widthMin}
          max={widthMaxDisplay}
          step={widthStep}
          onCommit={handleWidthChange}
          disabled={disabled}
          ariaLabel={effectiveUnit === 'px' ? '横幅 (px)' : '横幅 (%)'}
        />
      </div>

      {advanced ? (
        <div className="field">
          <label>
            縦幅:{' '}
            <strong>
              {effectiveUnit === 'px' ? `${value.height} px` : `${heightDisplay}%`}
            </strong>{' '}
            （元動画 {meta.height} px）
          </label>
          <input
            type="range"
            min={heightMin}
            max={heightMaxDisplay}
            step={heightStep}
            value={heightDisplay}
            onChange={onHeightInput}
            disabled={disabled}
            aria-label={effectiveUnit === 'px' ? '縦幅 (px)' : '縦幅 (%)'}
          />
          <NumericInput
            value={heightDisplay}
            min={heightMin}
            max={heightMaxDisplay}
            step={heightStep}
            onCommit={handleHeightChange}
            disabled={disabled}
            ariaLabel={effectiveUnit === 'px' ? '縦幅 (px)' : '縦幅 (%)'}
          />
          <p className="muted small">
            実効サイズ: {value.width} × {value.height} px
            {effectiveLock ? '（縦横比ロック）' : '（個別指定）'}
          </p>
        </div>
      ) : (
        <p className="muted small">
          高さ: {value.height} px（縦横比ロック）
        </p>
      )}

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
        <NumericInput
          value={value.fps}
          min={FPS_MIN}
          max={FPS_MAX}
          onCommit={updateFps}
          disabled={disabled}
          ariaLabel="フレームレート (fps)"
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

export function computeWidth(height: number, aspectRatio: number): number {
  if (!aspectRatio || !Number.isFinite(aspectRatio)) return 0;
  return makeEven(Math.max(2, Math.round(height * aspectRatio)));
}
