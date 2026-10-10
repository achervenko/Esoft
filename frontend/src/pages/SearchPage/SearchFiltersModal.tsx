import { useState } from "react";
import { AdminModal } from "../../shared/ui/AdminModal";

export function SearchFiltersModal({ module, availableModules, onApply, onClose }: {
  module: string;
  availableModules: { id: string; label: string }[];
  onApply: (module: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(module ? module.split(",") : availableModules.map((entry) => entry.id));
  return (
    <AdminModal title="Фильтры поиска" className="search-filters-modal" onClose={onClose}>
      <form className="search-filters-form" onSubmit={(event) => {
        event.preventDefault();
        if (!selected.length) return;
        onApply(selected.length === availableModules.length ? "" : availableModules.filter((entry) => selected.includes(entry.id)).map((entry) => entry.id).join(","));
      }}>
        {availableModules.length > 1 ? <fieldset className="search-module-options">
          <legend>Модули</legend>
          {availableModules.map(({ id: value, label }) => (
            <label key={value}>
              <input type="checkbox" checked={selected.includes(value)} onChange={(event) => {
                setSelected((previous) => event.target.checked ? [...previous, value] : previous.filter((entry) => entry !== value));
              }} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset> : <p className="search-single-module">Поиск выполняется в модуле «{availableModules[0]?.label}».</p>}
        <div className="search-filter-actions">
          <button type="button" className="admin-secondary-button" onClick={() => setSelected(availableModules.map((entry) => entry.id))}>Сбросить</button>
          <button type="submit" className="admin-primary-button" disabled={!selected.length}>Применить</button>
        </div>
      </form>
    </AdminModal>
  );
}
