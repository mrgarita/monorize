export function Footer() {
  const base = import.meta.env.BASE_URL ?? '/';
  const guideHref = `${base}guide.html`;
  const privacyHref = `${base}privacy.html`;
  return (
    <footer className="foot">
      <span>© 2026 monorize</span>
      <a href={guideHref} target="_blank" rel="noopener">
        使い方
      </a>
      <a href={privacyHref} target="_blank" rel="noopener">
        プライバシー
      </a>
      <a
        href="https://github.com/mrgarita/monorize"
        target="_blank"
        rel="noopener"
      >
        GitHub
      </a>
    </footer>
  );
}
