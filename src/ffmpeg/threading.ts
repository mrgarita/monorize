export type ThreadingMode = 'mt' | 'st';

export interface CorePaths {
  coreURL: string;
  wasmURL: string;
  workerURL?: string;
}

export function detectThreadingMode(): ThreadingMode {
  // 既定は st。core-mt は GIF エンコードで pthread 同期によりハングするため、
  // GIF 出力では現状 st のみ実用可能。mt の調査用に ?ff=mt のみ受け付ける。
  if (typeof location !== 'undefined') {
    if (new URLSearchParams(location.search).get('ff') === 'mt') return 'mt';
  }
  return 'st';
}

export function resolveCorePaths(mode: ThreadingMode, baseUrl: string): CorePaths {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (mode === 'mt') {
    return {
      coreURL: `${base}ffmpeg/core-mt/ffmpeg-core.js`,
      wasmURL: `${base}ffmpeg/core-mt/ffmpeg-core.wasm`,
      workerURL: `${base}ffmpeg/core-mt/ffmpeg-core.worker.js`,
    };
  }
  return {
    coreURL: `${base}ffmpeg/core/ffmpeg-core.js`,
    wasmURL: `${base}ffmpeg/core/ffmpeg-core.wasm`,
  };
}
