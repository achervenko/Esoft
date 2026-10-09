import { useState } from "react";
import type {
  IssueFilters,
  PpeEmployee,
  PpePosition,
  PpeItem,
} from "../../shared/api/ppe";
import { AdminModal } from "../../shared/ui/AdminModal";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import { SearchSelect } from "../../shared/ui/SearchSelect";
import { Field } from "../../modules/ppe-ui/ppe-ui";
import { employeeName } from "../../modules/ppe-ui/ppe-presentation";
type JournalFiltersModalProps = {
  applied: IssueFilters;
  employees: PpeEmployee[];
  positions: PpePosition[];
  items: PpeItem[];
  onApply: (filters: IssueFilters) => void;
  onClose: () => void;
};
export function JournalFiltersModal({
  applied,
  employees,
  positions,
  items,
  onApply,
  onClose,
}: JournalFiltersModalProps) {
  const [filters, setFilters] = useState<IssueFilters>({ ...applied });
  const set = (key: keyof IssueFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  return (
    <AdminModal
      title="Фильтры журнала"
      className="ppe-journal-filter-modal"
      onClose={onClose}
    >
      <form
        id="ppe-journal-filters"
        className="ppe-filter-grid ppe-journal-filters"
        onSubmit={(e) => {
          e.preventDefault();
          onApply({ ...filters });
        }}
      >
        <Field label="Сотрудник">
          <AppSelect
            value={filters.employeeId ?? ""}
            onChange={(e) => set("employeeId", e.target.value)}
          >
            <option value="">Все сотрудники</option>
            {employees.map((item) => (
              <option key={item.id} value={item.id}>
                {employeeName(item)}
              </option>
            ))}
          </AppSelect>
        </Field>
        <Field label="Должность">
          <AppSelect
            value={filters.positionId ?? ""}
            onChange={(e) => set("positionId", e.target.value)}
          >
            <option value="">Все должности</option>
            {positions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </AppSelect>
        </Field>
        <div className="ppe-journal-nomenclature">
          <SearchSelect
            label="Номенклатура"
            placeholder="Артикул или название"
            value={filters.ppeItemId ? Number(filters.ppeItemId) : null}
            options={items.map((item) => ({
              id: item.id,
              name: `${item.article} — ${item.name}`,
            }))}
            onChange={(id) => set("ppeItemId", id === null ? "" : String(id))}
          />
        </div>
        <Field label="Вид выдачи">
          <AppSelect
            value={filters.issueType ?? ""}
            onChange={(e) => set("issueType", e.target.value)}
          >
            <option value="">Все виды</option>
            <option value="REGULAR">Нормативная</option>
            <option value="EXTRA">Дополнительная</option>
          </AppSelect>
        </Field>
        <Field label="Статус">
          <AppSelect
            value={filters.status ?? ""}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">Все статусы</option>
            <option value="ISSUED">Выдано</option>
            <option value="CANCELLED">Отменено</option>
          </AppSelect>
        </Field>
        <Field label="Дата с">
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            max={filters.dateTo || undefined}
            onChange={(e) => set("dateFrom", e.target.value)}
          />
        </Field>
        <Field label="Дата по">
          <input
            type="date"
            value={filters.dateTo ?? ""}
            min={filters.dateFrom || undefined}
            onChange={(e) => set("dateTo", e.target.value)}
          />
        </Field>
        <div className="ppe-actions">
          <button className="admin-primary-button">Применить</button>
          <button
            className="admin-secondary-button"
            type="button"
            onClick={() => {
              onApply({});
            }}
          >
            Сбросить
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
