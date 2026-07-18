import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { getFocusableElements } from "./focusable-elements";

type AdminModalProps = {
  children: ReactNode;
  className?: string;
  isCloseDisabled?: boolean;
  onClose: () => void;
  title: string;
};

export function AdminModal({
  children,
  className,
  isCloseDisabled = false,
  onClose,
  title,
}: AdminModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const dialogId = useId();
  const titleId = useId();

  const handleClose = () => {
    if (!isCloseDisabled) {
      onClose();
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return undefined;
    }

    const previousActiveElement = document.activeElement;
    const autofocusTarget = dialog.querySelector<HTMLElement>("[autofocus]");
    const focusableElements = getFocusableElements(dialog);
    const initialFocusTarget = autofocusTarget ?? focusableElements[0] ?? dialog;

    initialFocusTarget.focus();

    return () => {
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      handleClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const focusableElements = getFocusableElements(dialog);

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const currentIndex = focusableElements.indexOf(
      document.activeElement as HTMLElement,
    );

    if (currentIndex < 0) {
      event.preventDefault();
      focusableElements[0].focus();
      return;
    }

    event.preventDefault();

    const nextIndex = event.shiftKey
      ? (currentIndex - 1 + focusableElements.length) % focusableElements.length
      : (currentIndex + 1) % focusableElements.length;

    focusableElements[nextIndex]?.focus();
  };

  return createPortal(
    <div
      className="admin-modal-backdrop"
      onMouseDown={handleClose}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={["admin-modal", className].filter(Boolean).join(" ")}
        data-admin-modal-id={dialogId}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <button
            aria-label="Закрыть"
            disabled={isCloseDisabled}
            onClick={handleClose}
            type="button"
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
