interface Props {
  message: string;
  onReset: () => void;
}

export function ErrorView({ message, onReset }: Props) {
  return (
    <div className="panel fade-in">
      <div className="err">
        <div className="err-ico" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
        </div>
        <div>
          <h2 className="conv-title">エラーが発生しました</h2>
          <p className="err-msg" role="alert">
            {message}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onReset}>
          最初に戻る
        </button>
      </div>
    </div>
  );
}
