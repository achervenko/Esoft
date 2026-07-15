import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type AdminModalProps = {
  children: ReactNode;
  onClose: () => void;
  title: string;
};

export function AdminModal({ children, onClose, title }: AdminModalProps) {
  return createPortal(
    <div
      className="admin-modal-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="admin-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Закрыть" onClick={onClose} type="button">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
