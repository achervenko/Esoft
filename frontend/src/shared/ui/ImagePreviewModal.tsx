import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

  return (
    <div
      className="image-preview-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-label={ariaLabel}
        aria-modal="true"
        className="image-preview-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Закрыть"
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
    </div>
  );
}
