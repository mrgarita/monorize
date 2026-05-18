export function Brand() {
  return (
    <a
      href="."
      className="brand"
      onClick={(e) => e.preventDefault()}
      aria-label="monorize ホーム"
    >
      <span className="brand-mark" aria-hidden="true" />
      <span>monorize</span>
    </a>
  );
}
