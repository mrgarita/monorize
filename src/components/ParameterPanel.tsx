import { useEffect, useState } from 'react';
import { FPS_MAX, FPS_MIN, OUTPUT_WARN_BYTES, SCALE_MIN_PX } from '../lib/constants';
import { estimateOutputBytes } from '../lib/estimateOutput';
import { formatBytes } from '../lib/format';
import type { VideoMeta } from '../lib/videoMeta';
import { NumericInput } from './NumericInput';
import { Seg } from './Seg';
import { Slider } from './Slider';

export interface ConvertParams {
  width: number;
  height: number;
  fps: number;
}

type Unit = 'px' | 'percent';
type Lock = 'lock' | 'free';

interface Props {
  file: File;
  meta: VideoMeta;
  value: ConvertParams;
  onChange: (next: ConvertParams) => void;
  onConvert: () => void;
  onCancel: () => void;
  disabled?: boolean;
  advanced?: boolean;
}

export function ParameterPanel({
  file,
  meta,
  value,
  onChange,
  onConvert,
  onCancel,
  disabled,
  advanced,
}: Props) {
  const [unit, setUnit] = useState<Unit>('px');
  const [lockAspect, setLockAspect] = useState(true);
  const effectiveUnit: Unit = advanced ? unit : 'px';
  const effectiveLock = advanced ? lockAspect : true;

  // シンプルモード時は、詳細モードで個別指定にしていた残り値を縦横比どおりに揃え直す。
  useEffect(() => {
    if (advanced) return;
    const expectedHeight = computeHeight(value.width, meta.aspectRatio);
    if (value.height !== expectedHeight) {
      onChange({ ...value, height: expectedHeight });
    }
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

  const widthPercentMin = Math.max(1, Math.ceil((SCALE_MIN_PX / maxWidth) * 100));
  const widthDisplay =
    effectiveUnit === 'px' ? value.width : Math.round((value.width / maxWidth) * 100);
  const widthMin = effectiveUnit === 'px' ? SCALE_MIN_PX : widthPercentMin;
  const widthMaxDisplay = effectiveUnit === 'px' ? maxWidth : 100;
  const widthStep = effectiveUnit === 'px' ? 2 : 1;

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

  const handleLockChange = (next: Lock) => {
    const lock = next === 'lock';
    setLockAspect(lock);
    if (lock) {
      setSize(value.width, computeHeight(value.width, meta.aspectRatio));
    }
  };

  const estimated = estimateOutputBytes(value.width, value.height, value.fps, meta.duration);
  const willWarn = estimated > OUTPUT_WARN_BYTES;

  const unitLabel = effectiveUnit === 'px' ? 'px' : '%';

  return (
    <div className="panel fade-in">
      <div className="params">
        <div className="file-chip">
          <div className="file-thumb" aria-hidden="true">
            <div className="tape t" />
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <div className="tape b" />
          </div>
          <div className="file-meta">
            <div className="file-name">{file.name}</div>
            <div className="file-stats">
              {formatBytes(file.size)} · {meta.width}×{meta.height} ·{' '}
              {meta.duration.toFixed(1)}秒
            </div>
          </div>
          <button
            type="button"
            className="file-close"
            onClick={onCancel}
            aria-label="ファイルを解除"
            disabled={disabled}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <div className="params-head">
          <h2 className="params-title">変換パラメータ</h2>
          <span className="field-orig">出力: GIF / モノクロ</span>
        </div>

        {advanced && (
          <div className="adv-row">
            <Seg<Lock>
              small
              value={lockAspect ? 'lock' : 'free'}
              options={[
                { value: 'lock', label: '縦横比ロック' },
                { value: 'free', label: '個別指定' },
              ]}
              onChange={handleLockChange}
              ariaLabel="縦横比"
            />
            <Seg<Unit>
              small
              value={unit}
              options={[
                { value: 'px', label: 'px' },
                { value: 'percent', label: '%' },
              ]}
              onChange={setUnit}
              ariaLabel="サイズの単位"
            />
          </div>
        )}

        {/* 横幅 */}
        <div className="field">
          <div className="field-row">
            <span className="field-label">横幅</span>
            <span className="field-orig">元 {meta.width} px</span>
          </div>
          <NumericInput
            value={widthDisplay}
            min={widthMin}
            max={widthMaxDisplay}
            step={widthStep}
            unit={unitLabel}
            onCommit={handleWidthChange}
            disabled={disabled}
            ariaLabel={`横幅 (${unitLabel})`}
          />
          <Slider
            min={widthMin}
            max={widthMaxDisplay}
            step={widthStep}
            value={widthDisplay}
            onChange={handleWidthChange}
            disabled={disabled}
            ariaLabel={`横幅 (${unitLabel})`}
          />
          <div className="field-foot">
            <span>{widthMin}</span>
            <span>{widthMaxDisplay}</span>
          </div>
        </div>

        {/* 縦幅 */}
        {advanced ? (
          <div className="field">
            <div className="field-row">
              <span className="field-label">縦幅</span>
              <span className="field-orig">元 {meta.height} px</span>
            </div>
            <NumericInput
              value={heightDisplay}
              min={heightMin}
              max={heightMaxDisplay}
              step={heightStep}
              unit={unitLabel}
              onCommit={handleHeightChange}
              disabled={disabled}
              ariaLabel={`縦幅 (${unitLabel})`}
            />
            <Slider
              min={heightMin}
              max={heightMaxDisplay}
              step={heightStep}
              value={heightDisplay}
              onChange={handleHeightChange}
              disabled={disabled}
              ariaLabel={`縦幅 (${unitLabel})`}
            />
            <div className="field-foot">
              <span>{heightMin}</span>
              <span>
                実効: {value.width} × {value.height} px{' '}
                {effectiveLock ? '(ロック)' : '(個別)'}
              </span>
            </div>
          </div>
        ) : (
          <div className="field">
            <div className="field-row">
              <span className="field-label">縦幅（自動）</span>
              <span className="field-orig">縦横比ロック</span>
            </div>
            <div className="field-val">
              {value.height}
              <span className="u">px</span>
            </div>
          </div>
        )}

        {/* フレームレート */}
        <div className="field">
          <div className="field-row">
            <span className="field-label">フレームレート</span>
            <span className="field-orig">
              {FPS_MIN}〜{FPS_MAX} fps
            </span>
          </div>
          <NumericInput
            value={value.fps}
            min={FPS_MIN}
            max={FPS_MAX}
            unit="fps"
            onCommit={updateFps}
            disabled={disabled}
            ariaLabel="フレームレート (fps)"
          />
          <Slider
            min={FPS_MIN}
            max={FPS_MAX}
            value={value.fps}
            onChange={updateFps}
            disabled={disabled}
            ariaLabel="フレームレート (fps)"
          />
          <div className="field-foot">
            <span>{FPS_MIN}</span>
            <span>{FPS_MAX}</span>
          </div>
        </div>

        <div className={`estimate ${willWarn ? 'warn' : ''}`}>
          <div className="estimate-ico">GIF</div>
          <div className="estimate-row">
            <div>
              <div className="estimate-title">
                {willWarn ? '出力が大きくなる見込みです' : '推定出力サイズ'}
              </div>
              <div className="estimate-formula">W × H × fps × duration × 0.30</div>
            </div>
            <div className="estimate-val">最大 {formatBytes(estimated)}</div>
          </div>
        </div>

        <div className="actions-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={disabled}
          >
            別の動画を選ぶ
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConvert}
            disabled={disabled}
          >
            変換を実行 <span className="arr">→</span>
          </button>
        </div>
      </div>
    </div>
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
