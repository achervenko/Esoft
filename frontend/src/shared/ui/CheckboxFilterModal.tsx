import { useState } from "react";
import { AdminModal } from "./AdminModal";
import "./CheckboxFilterModal.css";

export function CheckboxFilterModal<Value extends string>({
  title,
  legend = "Статусы",
  options,
  values,
  onApply,
  onClose,
}: {
  title: string;
  legend?: string;
  options: ReadonlyArray<{ value: Value; label: string }>;
  values: readonly Value[];
  onApply: (values: Value[]) => void;
  onClose: () => void;
}) {
  const allValues = options.map(({ value }) => value);
  const [selected, setSelected] = useState<Value[]>(
    values.length ? [...values] : allValues,
  );
  return (
    <AdminModal
      title={title}
      className="checkbox-filter-modal"
      onClose={onClose}
    >
      <form
        className="checkbox-filter-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected.length)
            onApply(selected.length === allValues.length ? [] : selected);
        }}
      >
        <fieldset className="checkbox-filter-options">
          <legend>{legend}</legend>
          {options.map(({ value, label }) => (
            <label key={value}>
              <input
                type="checkbox"
                value={value}
                checked={selected.includes(value)}
                onChange={(event) =>
                  setSelected((previous) =>
                    event.target.checked
                      ? [...previous, value]
                      : previous.filter((v) => v !== value),
                  )
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <div className="checkbox-filter-actions">
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => setSelected(allValues)}
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
