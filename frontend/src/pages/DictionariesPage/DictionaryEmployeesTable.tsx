import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import { useProgressiveRows } from "../../shared/lib/useProgressiveRows";
import { LoadMore } from "../../shared/ui/LoadMore";
import { useEmployeeDictionarySearch } from "./useEmployeeDictionarySearch";
import { Notice } from "../../shared/ui/Notice";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { useEffect, useState } from "react";
import { EmployeeDictionaryDetailsModal } from "./EmployeeDictionaryDetailsModal";
import { sortDataTableRows } from "../../shared/ui/data-table-model";
import { ChevronRight, Edit2 } from "lucide-react";
import type { AdminEmployee } from "../../shared/api/users-admin-api";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import { Switch } from "../../shared/ui/Switch";
import type { EmployeeSizes } from "../../shared/api/ppe";
import { employeeSizesStatus } from "../../modules/ppe-ui/employee-sizes-model";

type DictionaryEmployeesTableProps = {
  employees: AdminEmployee[];
  onCreate?: () => void;
  isSaving?: boolean;
  onEdit: (employee: AdminEmployee) => void;
  onToggleStatus: (employee: AdminEmployee) => void;
  onSizes?: (employee: AdminEmployee) => void;
  employeeSizes?: ReadonlyMap<number, EmployeeSizes | null>;
};

const employeeColumns = (
  onEdit: (employee: AdminEmployee) => void,
  onToggleStatus: (employee: AdminEmployee) => void,
  isSaving: boolean,
  onSizes?: (employee: AdminEmployee) => void,
  employeeSizes?: ReadonlyMap<number, EmployeeSizes | null>,
): Array<DataTableColumn<AdminEmployee, string>> => [
  {
    key: "fullName",
    label: "Сотрудник",
    render: (employee) => <strong>{employee.fullName}</strong>,
    sortValue: (employee) => employee.fullName,
  },
  {
    key: "position",
    label: "Должность",
    render: (employee) =>
      [
        employee.position,
        ...(employee.additionalPositions ?? []).map(({ name }) => name),
      ].join(", "),
    sortValue: (employee) => employee.position,
  },
  {
    key: "gender",
    label: "Пол",
    render: (employee) =>
      employee.gender === "MALE"
        ? "Мужской"
        : employee.gender === "FEMALE"
          ? "Женский"
          : "Не указан",
    sortValue: (employee) => employee.gender ?? "",
  },
  {
    key: "status",
    label: "Статус",
    sortValue: (employee) => Number(employee.isActive),
    render: (employee) => (
      <Switch
        label={`Активность сотрудника ${employee.fullName}`}
        checked={employee.isActive}
        disabled={
          isSaving || (employee.isActive && employee.isLinkedToCurrentUser)
        }
        onChange={() => onToggleStatus(employee)}
        title={
          employee.isActive && employee.isLinkedToCurrentUser
            ? "Нельзя отключить сотрудника, связанного с текущей учётной записью"
            : employee.isActive
              ? "Отключить сотрудника"
              : "Включить сотрудника"
        }
      />
    ),
  },
  {
    key: "actions",
    className: "admin-table-actions-column",
    label: "",
    render: (employee) => {
      const status = employeeSizes?.has(employee.id)
        ? employeeSizesStatus(employeeSizes.get(employee.id) ?? null)
        : "complete";
      const warning =
        status === "missing"
          ? "Размеры не заполнены"
          : "Размеры заполнены частично";
      return (
        <div className="admin-table-actions">
          {onSizes && (
            <button
              className="employee-sizes-button"
              type="button"
              disabled={isSaving}
              onClick={() => onSizes(employee)}
            >
              Размеры
              {status !== "complete" && (
                <span
                  className={`employee-sizes-dot ${status}`}
                  role="img"
                  aria-label={warning}
                  title={warning}
                />
              )}
            </button>
          )}
          <button
            aria-label={`Редактировать сотрудника ${employee.fullName}`}
            className="admin-icon-button"
            disabled={isSaving}
            onClick={() => onEdit(employee)}
            title="Редактировать"
            type="button"
          >
            <Edit2 size={17} />
          </button>
        </div>
      );
    },
  },
];

export function DictionaryEmployeesTable({
  employees,
  onCreate,
  isSaving = false,
  onEdit,
  onToggleStatus,
  onSizes,
  employeeSizes,
}: DictionaryEmployeesTableProps) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!isMobile) setSelectedId(null);
  }, [isMobile]);

  const columns = employeeColumns(
    (employee) => {
      setSelectedId(null);
      onEdit(employee);
    },
    onToggleStatus,
    isSaving,
    onSizes
      ? (employee) => {
          setSelectedId(null);
          onSizes(employee);
        }
      : undefined,
    employeeSizes,
  );
  const group = (employee: AdminEmployee) => (employee.isActive ? 0 : 1);
  const defaultSort = { direction: "asc" as const, key: "fullName" };

  const { filtered, isSearching, error, limited, retry } =
    useEmployeeDictionarySearch(employees, query);
  const selected = filtered.find(({ id }) => id === selectedId);
  useEffect(() => {
    if (selectedId !== null && !selected) setSelectedId(null);
  }, [selectedId, selected]);
  const search = (
    <>
      <SearchToolbar
        value={query}
        onChange={setQuery}
        label="Поиск сотрудников"
        onCreate={onCreate}
        createDisabled={isSaving}
      />
      <LoadingIndicator loading={isSearching}>
        Поиск сотрудников…
      </LoadingIndicator>
      {error && (
        <Notice tone="error">
          Не удалось выполнить расширенный поиск: {error}
          <p>Показаны только точные совпадения по ФИО и должностям.</p>
          <button
            className="admin-secondary-button"
            type="button"
            onClick={retry}
          >
            Повторить поиск
          </button>
        </Notice>
      )}
      {limited && (
        <Notice>
          Дополнительные совпадения ограничены первыми 100 результатами.
          Уточните запрос.
        </Notice>
      )}
    </>
  );
  const empty =
    !isSearching && !error ? (
      <p className="admin-state" role="status">
        Сотрудники не найдены.
      </p>
    ) : null;

  const sorted = sortDataTableRows(filtered, columns, defaultSort, group);
  const visible = useProgressiveRows(sorted, (employee) => employee.id, query);
  if (isMobile) {
    return (
      <>
        {search}
        {filtered.length === 0 && empty}
        <div className="dictionary-employee-cards" aria-label="Сотрудники">
          {visible.rows.map((employee) => (
            <button
              className="dictionary-employee-card"
              key={employee.id}
              type="button"
              aria-label={`Открыть карточку сотрудника ${employee.fullName}`}
              onClick={() => setSelectedId(employee.id)}
            >
              <span>
                <strong>{employee.fullName}</strong>
                <span className="dictionary-employee-position">
                  {columns
                    .find(({ key }) => key === "position")
                    ?.render(employee)}
                </span>
              </span>
              <ChevronRight aria-hidden="true" size={20} />
            </button>
          ))}
        </div>
        {sorted.length > 100 && (
          <LoadMore
            shown={visible.rows.length}
            total={sorted.length}
            hasMore={visible.hasMore}
            loading={false}
            error={null}
            onLoadMore={visible.loadMore}
            onRetry={visible.loadMore}
          />
        )}
        {selected && (
          <EmployeeDictionaryDetailsModal
            title={selected.fullName}
            onClose={() => setSelectedId(null)}
            isSaving={isSaving}
            showSizes={Boolean(onSizes)}
            sizes={employeeSizes?.get(selected.id)}
            details={columns
              .filter(({ key }) =>
                ["position", "gender", "status"].includes(key),
              )
              .map((column) => (
                <div key={column.key}>
                  <dt>{column.label}</dt>
                  <dd>{column.render(selected)}</dd>
                </div>
              ))}
            actions={columns
              .find(({ key }) => key === "actions")
              ?.render(selected)}
          />
        )}
      </>
    );
  }

  return (
    <>
      {search}
      {filtered.length === 0 ? (
        empty
      ) : (
        <div className="dictionary-table-surface">
          <DataTable
            columns={columns}
            defaultSort={defaultSort}
            getRowKey={(employee) => employee.id}
            rows={filtered}
            getRowGroup={group}
            animateRowMoves
          />
        </div>
      )}
    </>
  );
}
