import { Search, Trash2 } from "lucide-react";
import type { PpeItem } from "../../shared/api/ppe";
import { Field } from "../../modules/ppe-ui/ppe-ui";
import { SearchSelect } from "../../shared/ui/SearchSelect";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import type { DraftRow } from "./norm-form-model";

export function NormDraftRow({
  row,
  rows,
  items,
  disabled,
  validated,
  focusOnMount,
  onChange,
  onRemove,
}: {
  row: DraftRow;
  rows: DraftRow[];
  items: PpeItem[];
  disabled: boolean;
  validated: boolean;
  focusOnMount: boolean;
  onChange: (patch: Partial<DraftRow>) => void;
  onRemove: () => void;
}) {
  return (
    <fieldset className="ppe-draft-row" disabled={disabled}>
      <SearchSelect
        label="СИЗ"
        focusOnMount={focusOnMount}
        placement="bottom"
        className="ppe-field"
        icon={<Search size={18} aria-hidden="true" />}
        emptyMessage="СИЗ не найдены"
        noMatchError="СИЗ с таким названием или артикулом не найден. Выберите позицию из списка."
        error={
          validated && !row.ppeItemId ? "Выберите СИЗ из списка." : undefined
        }
        required
        disabled={disabled}
        value={row.ppeItemId ? Number(row.ppeItemId) : null}
        onChange={(id) =>
          onChange({
            ppeItemId: id === null ? "" : String(id),
          })
        }
        options={items
          .filter(
            (item) =>
              String(item.id) === row.ppeItemId ||
              (item.isActive &&
                !rows.some(
                  (other) =>
                    other.key !== row.key &&
                    other.ppeItemId === String(item.id),
                )),
          )
          .map((item) => ({
            id: item.id,
            name: `${item.article} — ${item.name}${!item.isActive ? " (удалён)" : ""}`,
          }))}
      />
      <Field label="Кол-во">
        <input
          required
          type="number"
          min="0.001"
          step="0.001"
          value={row.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
        />
      </Field>
      <Field label="Период">
        <input
          required
          type="number"
          min="1"
          step="1"
          value={row.periodCount}
          onChange={(e) => onChange({ periodCount: e.target.value })}
        />
      </Field>
      <label className="ppe-field">
        <AppSelect
          aria-label="Единица периода"
          className="ppe-period-unit-select"
          selectedLabel={
            { YEAR: "Год", MONTH: "Мес", DAY: "Дн" }[row.periodUnit]
          }
          value={row.periodUnit}
          onChange={(e) =>
            onChange({
              periodUnit: e.target.value as "DAY" | "MONTH" | "YEAR",
            })
          }
        >
          <option value="YEAR">Год</option>
          <option value="MONTH">Месяц</option>
          <option value="DAY">День</option>
        </AppSelect>
      </label>
      <button
        className="admin-icon-button ppe-delete-icon-button"
        aria-label="Удалить"
        title="Удалить позицию нормы"
        type="button"
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" size={17} />
      </button>
    </fieldset>
  );
}
