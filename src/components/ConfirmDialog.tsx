import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  severity?: 'warning';
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  severity,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const onCancelEvent = (e: Event) => {
    // Esc キーが押されたとき <dialog> は cancel イベントを発火する
    e.preventDefault();
    onCancel();
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('cancel', onCancelEvent);
    return () => el.removeEventListener('cancel', onCancelEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCancel]);

  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <dialog
      ref={ref}
      className={`confirm-dialog${severity === 'warning' ? ' is-warning' : ''}`}
      aria-labelledby={titleId}
      onClick={onBackdropClick}
    >
      <div className="confirm-dialog__body">
        <h2 id={titleId} className="confirm-dialog__title">
          {title}
        </h2>
        <div className="confirm-dialog__message">{message}</div>
        <div className="confirm-dialog__actions">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
