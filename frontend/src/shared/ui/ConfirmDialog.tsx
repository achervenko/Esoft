import { TriangleAlert } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";
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
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    requestAnimationFrame(() => {
      if (cancelButtonRef.current && !cancelButtonRef.current.disabled) {
        cancelButtonRef.current.focus();
        return;
      }

      dialogRef.current?.focus();
    });

    return () => {
      previousActiveElementRef.current?.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !isLoading) {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(dialogRef.current);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return createPortal(
    <div
      aria-labelledby="confirm-dialog-title"
      aria-modal="true"
      className="confirm-dialog-backdrop"
      onKeyDown={handleKeyDown}
      onMouseDown={() => {
        if (!isLoading) {
          onCancel();
        }
      }}
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
            <h2 id="confirm-dialog-title">{title}</h2>
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

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.offsetParent !== null,
  );
}
