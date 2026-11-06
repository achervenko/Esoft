import { AdminModal } from "../../shared/ui/AdminModal";
import { TextField } from "../../shared/ui/TextField";
import { SelectField } from "../../shared/ui/SelectField";
import type { Warehouse } from "../../shared/api/warehouses-api";
import type { ReceiptListPreferences } from "./receipt-list-preferences";
import { receiptStatus } from "./receipt-utils";

export function ReceiptListFilters({
  preferences,
  warehouses,
  invalidPeriod,
  onChange: update,
  onClose,
}: {
  preferences: ReceiptListPreferences;
  warehouses: Warehouse[];
  invalidPeriod: boolean;
  onChange: (patch: Partial<ReceiptListPreferences>) => void;
  onClose: () => void;
}) {
  const {
    documentDateFrom,
    documentDateTo,
    warehouseId,
    states,
    source,
    problems,
  } = preferences;
  return (
    <AdminModal title="Настройки поиска" onClose={onClose}>
      <div className="admin-form">
        <div className="receipt-grid">
          <TextField
            label="Дата документа с"
            type="date"
            value={documentDateFrom}
            onChange={(documentDateFrom) => update({ documentDateFrom })}
          />
          <TextField
            label="Дата документа по"
            type="date"
            value={documentDateTo}
            onChange={(documentDateTo) => update({ documentDateTo })}
            error={
              invalidPeriod ? "Дата окончания раньше даты начала." : undefined
            }
          />
        </div>

        <SelectField
          label="Склад"
          value={warehouseId}
          onChange={(v) => {
            update({ warehouseId: v });
          }}
          searchable
          options={[
            { value: "", label: "Все склады" },
            ...warehouses.map((w) => ({
              value: w.id,
              label: w.name,
            })),
          ]}
        />
        <SelectField
          label="Состояния"
          multiple
          value={states}
          onChange={(states) => update({ states })}
          placeholder="Все состояния"
          options={[
            ...Object.entries(receiptStatus).map(([value, label]) => ({
              value,
              label,
            })),
            { value: "CONFLICT", label: "Конфликт с 1С" },
          ]}
        />
        <SelectField
          label="Источник"
          value={source}
          onChange={(v) => {
            update({ source: v });
          }}
          options={[
            { value: "", label: "Все" },
            { value: "ONE_C", label: "1С" },
            { value: "MANUAL", label: "Ручной ввод" },
          ]}
        />
        <SelectField
          label="Требует внимания"
          value={problems}
          onChange={(v) => {
            update({ problems: v });
          }}
          options={[
            { value: "", label: "Все документы" },
            { value: "WAREHOUSE", label: "Не сопоставлен склад" },
            { value: "ITEMS", label: "Не сопоставлена номенклатура" },
            {
              value: "MANUAL_DUPLICATE",
              label: "Возможно, принято вручную",
            },
          ]}
        />
        <button className="admin-primary-button" onClick={onClose}>
          Готово
        </button>
      </div>
    </AdminModal>
  );
}
