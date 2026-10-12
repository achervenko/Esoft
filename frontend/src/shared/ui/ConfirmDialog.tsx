import { useDialogBehavior } from "./useDialogBehavior";
import { useModalResizeAnimation } from "./useModalResizeAnimation";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import "./ConfirmDialog.css";

type ConfirmDialogVariant = "default" | "danger";

type ConfirmDialogProps = {
  cancelLabel: string;
  children?: ReactNode;
  confirmLabel: string;
  description: ReactNode;
  error?: string | null;
  isConfirmDisabled?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  variant?: ConfirmDialogVariant;
};

export function ConfirmDialog({
  cancelLabel,
  children,
  confirmLabel,
  description,
  error = null,
  isConfirmDisabled = false,
  isLoading = false,
  loadingLabel,
  onCancel,
  onConfirm,
  title,
  variant = "default",
}: ConfirmDialogProps) {
  const confirmText = isLoading && loadingLabel ? loadingLabel : confirmLabel;
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  useModalResizeAnimation(dialogRef);
  const titleId = useId();
  const { close, onKeyDown: handleKeyDown } = useDialogBehavior({
    dialogRef,
    initialFocusRef: cancelButtonRef,
    onClose: onCancel,
    closeDisabled: isLoading,
  });

  return createPortal(
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="confirm-dialog-backdrop"
      onKeyDown={handleKeyDown}
      onMouseDown={close}
      role="dialog"
    >
      <section
        className={`confirm-dialog confirm-dialog-${variant}`}
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="confirm-dialog-message">
          <TriangleAlert aria-hidden="true" size={26} />
          <div>
            <h2 id={titleId}>{title}</h2>
            <p>{description}</p>
          </div>
        </div>

        {children}

        {error ? <p className="confirm-dialog-error">{error}</p> : null}

        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-secondary"
            disabled={isLoading}
            ref={cancelButtonRef}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="confirm-dialog-primary"
            disabled={isLoading || isConfirmDisabled}
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
