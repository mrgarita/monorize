export interface VideoMeta {
  width: number;
  height: number;
  duration: number;
  aspectRatio: number;
}

export function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    video.addEventListener('loadedmetadata', () => {
      const { videoWidth, videoHeight, duration } = video;
      cleanup();
      if (!videoWidth || !videoHeight) {
        reject(new Error('動画のメタデータを取得できませんでした'));
        return;
      }
      resolve({
        width: videoWidth,
        height: videoHeight,
        duration: Number.isFinite(duration) ? duration : 0,
        aspectRatio: videoWidth / videoHeight,
      });
    });

    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('動画ファイルの読み込みに失敗しました'));
    });

    video.src = url;
  });
}
