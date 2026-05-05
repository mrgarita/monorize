import { useEffect, useState } from 'react';

interface Props {
  blob: Blob;
  filename: string;
}

export function DownloadButton({ blob, filename }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  if (!url) return null;
  return (
    <a className="download-button" href={url} download={filename}>
      GIF をダウンロード
    </a>
  );
}
