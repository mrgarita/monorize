interface Props {
  progress: number;
  label?: string;
}

export function ProgressBar({ progress, label }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <section className="progress" aria-label={label ?? '変換進捗'}>
      <progress value={pct} max={100} />
      <span aria-live="polite">{pct}%</span>
    </section>
  );
}
