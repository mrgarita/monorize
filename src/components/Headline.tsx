export function Headline() {
  return (
    <div className="heading">
      <div className="eyebrow">
        <span className="pip" aria-hidden="true" />
        <span>ブラウザ内で完結</span>
      </div>
      <h1 className="h1">
        動画を、<span className="accent">モノクロGIFへ。</span>
      </h1>
      <p className="lede">
        ブラウザの中だけで完結する、シンプルな変換ツール。
        <br />
        動画はサーバへ送信されません。
      </p>
    </div>
  );
}
