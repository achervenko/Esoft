import "../../shared/ui/AdminPage.css";
import "../../modules/ppe-ui/PpeLayout.css";
import { AppTable } from "../../shared/ui/AppTable";
import { ContextMenu } from "../../shared/ui/ContextMenu";
import { useState } from "react";
import { ppeApi } from "../../shared/api/ppe";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { Search } from "lucide-react";
import "../../shared/ui/SearchInput.css";
import { employeeName } from "../../modules/ppe-ui/ppe-presentation";
import { EmployeeSizesModal, EmployeeSizeSummary } from "./EmployeeSizesModal";
export function PpeEmployeesPanel() {
  const employees = usePpeQuery("ppe-employees", (signal) =>
    ppeApi.employees(signal),
  );
  const [search, setSearch] = useState("");
  const [id, setId] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  const filtered = employees.data?.filter(
    (item) =>
      item.isActive &&
      `${employeeName(item)} ${item.position}`
        .toLocaleLowerCase("ru")
        .includes(search.toLocaleLowerCase("ru")),
  );
  return (
    <section className="admin-page ppe-page">
      <header className="admin-page-header">
        <h1>Сотрудники</h1>
      </header>
      <section className="admin-card">
        <div className="search-input-shell">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Поиск сотрудника"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <PpeQueryState {...employees} page />
        {!employees.loading && filtered &&
          (filtered.length ? (
            <div className="ppe-table-wrap">
              <AppTable>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Должность</th>
                    <th>Размеры</th>
                    <th aria-label="Действия" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} onContextMenu={(event) => {
                      event.preventDefault();
                      setMenu({ id: item.id, x: event.clientX, y: event.clientY });
                    }}>
                      <td>{employeeName(item)}</td>
                      <td>{item.position}</td>
                      <td>
                        <EmployeeSizeSummary employee={item} />
                      </td>
                      <td>
                        <button
                          className="admin-secondary-button"
                          onClick={() => setId(item.id)}
                        >
                          Изменить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AppTable>
            </div>
          ) : (
            <p className="admin-state">Сотрудники не найдены.</p>
          ))}
      </section>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} label="Действия с размерами сотрудника"
          onClose={() => setMenu(null)}
          items={[{ id: "edit", label: "Изменить", onSelect: () => setId(menu.id) }]} />
      )}
      {id !== null && (
        <EmployeeSizesModal
          id={id}
          onClose={() => setId(null)}
          onChanged={employees.reload}
        />
      )}
    </section>
  );
}
