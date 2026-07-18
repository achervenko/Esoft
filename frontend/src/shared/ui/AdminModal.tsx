import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type AdminModalProps = {
  children: ReactNode;
  isCloseDisabled?: boolean;
  onClose: () => void;
  title: string;
};

export function AdminModal({
  children,
  isCloseDisabled = false,
  onClose,
  title,
}: AdminModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
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
      className="admin-modal-backdrop"
      onMouseDown={handleClose}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-modal"
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

function getFocusableElements(container: HTMLElement) {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      isElementVisible(element, container),
  );
}

function isElementVisible(element: HTMLElement, container: HTMLElement) {
  if (element.getClientRects().length === 0) {
    return false;
  }

  let currentElement: HTMLElement | null = element;

  while (currentElement && currentElement !== container.parentElement) {
    const style = window.getComputedStyle(currentElement);

    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    if (currentElement === container) {
      break;
    }

    currentElement = currentElement.parentElement;
  }

  return true;
}
