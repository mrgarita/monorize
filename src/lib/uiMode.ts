export type UiMode = 'simple' | 'advanced';

const STORAGE_KEY = 'monorize.uiMode';
const DEFAULT_MODE: UiMode = 'simple';

export function loadUiMode(): UiMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'simple' || v === 'advanced') return v;
  } catch {
    // localStorage が無効化されている場合は既定値にフォールバック
  }
  return DEFAULT_MODE;
}

export function saveUiMode(mode: UiMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // 永続化できなくても致命ではない
  }
}
