import { useModalResizeAnimation } from "./useModalResizeAnimation";
import "./AdminModal.css";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useDialogBehavior } from "./useDialogBehavior";
import { useMobileDialogViewport } from "./useMobileDialogViewport";
import "./MobileDialog.css";
import { DialogPopupReadyContext } from "./DialogPopupReadyContext";

type AdminModalProps = {
  animateResize?: boolean;
  children: ReactNode;
  className?: string;
  isCloseDisabled?: boolean;
  onClose: () => void;
  title: ReactNode;
};

export function AdminModal({
  animateResize = true,
  children,
  className,
  isCloseDisabled = false,
  onClose,
  title,
}: AdminModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const dialogId = useId();
  const titleId = useId();

  const { isMobile, isReady } = useMobileDialogViewport(dialogRef, backdropRef);
  useModalResizeAnimation(dialogRef, animateResize && !isMobile);

  const { close: handleClose, onKeyDown: handleKeyDown } = useDialogBehavior({
    dialogRef,
    onClose,
    closeDisabled: isCloseDisabled,
  });

  return createPortal(
    <DialogPopupReadyContext.Provider value={isReady}>
      <div
        className="admin-modal-backdrop mobile-dialog-backdrop"
        ref={backdropRef}
        onMouseDown={handleClose}
        role="presentation"
      >
        <section
          aria-labelledby={titleId}
          aria-modal="true"
          className={["admin-modal", "mobile-dialog", className]
            .filter(Boolean)
            .join(" ")}
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
              <X aria-hidden="true" size={20} />
            </button>
          </header>
          {children}
        </section>
      </div>
    </DialogPopupReadyContext.Provider>,
    document.body,
  );
}
