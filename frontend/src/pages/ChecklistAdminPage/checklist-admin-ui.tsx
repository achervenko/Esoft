import type { ReactNode } from "react";

export function Filters({
  children,
  onSearch,
}: {
  children: ReactNode;
  onSearch: () => void;
}) {
  return (
    <div className="checklist-admin-filters">
      {children}
      <button className="admin-secondary-button" onClick={onSearch} type="button">
        Найти
      </button>
    </div>
  );
}

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`checklist-admin-status ${isActive ? "active" : "inactive"}`}
    >
      {isActive ? "Активен" : "Неактивен"}
    </span>
  );
}
