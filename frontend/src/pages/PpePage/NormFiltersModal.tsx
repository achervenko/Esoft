import { useState } from "react";
import { AdminModal } from "../../shared/ui/AdminModal";
import "../../shared/ui/CheckboxFilterModal.css";
import { normStatusLabels, type NormCoverage } from "./norm-coverage";

export type NormStatusFilter = NormCoverage["status"][];
const allStatuses = Object.keys(normStatusLabels) as NormStatusFilter;

export function NormFiltersModal({
  statuses,
  onApply,
  onClose,
}: {
  statuses: NormStatusFilter;
  onApply: (statuses: NormStatusFilter) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<NormStatusFilter>(
    statuses.length ? statuses : allStatuses,
  );
  return (
    <AdminModal
      title="Фильтры норм"
      className="checkbox-filter-modal"
      onClose={onClose}
    >
      <form
        className="checkbox-filter-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected.length)
            onApply(selected.length === allStatuses.length ? [] : selected);
        }}
      >
        <fieldset className="checkbox-filter-options">
          <legend>Статусы</legend>
          {allStatuses.map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                value={value}
                checked={selected.includes(value)}
                onChange={(event) =>
                  setSelected((previous) =>
                    event.target.checked
                      ? [...previous, value]
                      : previous.filter((status) => status !== value),
                  )
                }
              />
              <span>{normStatusLabels[value]}</span>
            </label>
          ))}
        </fieldset>
        <div className="checkbox-filter-actions">
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => setSelected(allStatuses)}
          >
            Сбросить
          </button>
          <button
            type="submit"
            className="admin-primary-button"
            disabled={!selected.length}
          >
            Применить
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
