import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getFocusableElements } from "./focusable-elements";
import "./ImagePreviewModal.css";

type ImagePreviewModalProps = {
  ariaLabel: string;
  counterLabel?: string;
  imageAlt?: string;
  imageUrl: string;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
};

export function ImagePreviewModal({
  ariaLabel,
  counterLabel,
  imageAlt = "",
  imageUrl,
  onClose,
  onNext,
  onPrevious,
}: ImagePreviewModalProps) {
  const hasNavigation = Boolean(onNext && onPrevious);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return undefined;
    }

    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const autofocusTarget = dialog.querySelector<HTMLElement>("[autofocus]");
    const focusableElements = getFocusableElements(dialog);
    const initialFocusTarget = autofocusTarget ?? focusableElements[0] ?? dialog;

    document.body.style.overflow = "hidden";
    initialFocusTarget.focus();

    return () => {
      document.body.style.overflow = previousOverflow;

      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
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
      focusableElements[0]?.focus();
      return;
    }

    event.preventDefault();

    const nextIndex = event.shiftKey
      ? (currentIndex - 1 + focusableElements.length) % focusableElements.length
      : (currentIndex + 1) % focusableElements.length;

    focusableElements[nextIndex]?.focus();
  }

  return createPortal(
    <div
      className="image-preview-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-label={ariaLabel}
        aria-modal="true"
        className="image-preview-modal"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="Закрыть"
          autoFocus
          className="image-preview-close"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={22} />
        </button>

        {hasNavigation ? (
          <>
            <button
              aria-label="Предыдущее фото"
              className="image-preview-nav image-preview-nav-previous"
              onClick={onPrevious}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={24} />
            </button>
            <button
              aria-label="Следующее фото"
              className="image-preview-nav image-preview-nav-next"
              onClick={onNext}
              type="button"
            >
              <ChevronRight aria-hidden="true" size={24} />
            </button>
          </>
        ) : null}

        {counterLabel ? (
          <span className="image-preview-counter">{counterLabel}</span>
        ) : null}

        <img alt={imageAlt} src={imageUrl} />
      </section>
    </div>,
    document.body,
  );
}
