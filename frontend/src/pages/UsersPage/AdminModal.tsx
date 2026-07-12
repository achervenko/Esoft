import type { ReactNode } from "react";

type AdminModalProps = {
  children: ReactNode;
  onClose: () => void;
  title: string;
};

export function AdminModal({ children, onClose, title }: AdminModalProps) {
  return (
    <div className="users-modal-backdrop" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="users-modal"
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
