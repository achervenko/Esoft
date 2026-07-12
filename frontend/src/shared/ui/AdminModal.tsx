import type { ReactNode } from "react";

type AdminModalProps = {
  children: ReactNode;
  onClose: () => void;
  title: string;
};

export function AdminModal({ children, onClose, title }: AdminModalProps) {
  return (
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
    </div>
  );
}
