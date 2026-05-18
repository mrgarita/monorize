import { useEffect, type MouseEvent, type ReactNode } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="dlg-back"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onBackdropClick}
    >
      <div className="dlg">
        <div className="dlg-body">
          <div className="dlg-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.86l-8.07 14a2 2 0 0 0 1.74 3h16.14a2 2 0 0 0 1.74-3l-8.07-14a2 2 0 0 0-3.48 0z" />
            </svg>
          </div>
          <h3 className="dlg-title">{title}</h3>
          <div className="dlg-msg">{message}</div>
        </div>
        <div className="dlg-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
