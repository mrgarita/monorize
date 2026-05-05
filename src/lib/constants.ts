export const ACCEPTED_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.wmv',
  '.flv',
  '.m4v',
  '.ts',
  '.3gp',
] as const;

export const ACCEPTED_ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',');

export const INPUT_WARN_BYTES = 500 * 1024 * 1024;

export const OUTPUT_WARN_BYTES = 200 * 1024 * 1024;

export const FPS_MIN = 1;
export const FPS_MAX = 30;

export const SCALE_MIN_PX = 32;
