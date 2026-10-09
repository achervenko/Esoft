import { Search } from "lucide-react";
import type { PpeEmployee } from "../../shared/api/ppe";
import { SearchSelect } from "../../shared/ui/SearchSelect";
import { employeeName } from "../../modules/ppe-ui/ppe-presentation";

/** Employee-card navigation with the shared combobox's focus and keyboard behavior. */
export function EmployeeSearch({
  employees,
  onSelect,
}: {
  employees: PpeEmployee[];
  onSelect: (id: number) => void;
}) {
  return (
    <SearchSelect
      autoFocus
      appearance="search"
      label="Поиск по ФИО"
      hideLabel
      icon={<Search size={18} aria-hidden="true" />}
      className="ppe-employee-search"
      placeholder=""
      value={null}
      options={employees.map((employee) => ({
        id: employee.id,
        name: employeeName(employee),
        position: employee.position + (!employee.isActive ? " (отключён)" : ""),
      }))}
      maxResults={null}
      minQueryLength={1}
      emptyMessage="Сотрудники не найдены"
      filterOption={(option, query) =>
        query
          .split(/\s+/)
          .every((word) => option.name.toLocaleLowerCase("ru").includes(word))
      }
      onChange={(id) => {
        if (id !== null) onSelect(id);
      }}
    />
  );
}
