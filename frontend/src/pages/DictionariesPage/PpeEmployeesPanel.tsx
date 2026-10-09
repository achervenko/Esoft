import "../../shared/ui/AdminPage.css";
import "../../modules/ppe-ui/PpeLayout.css";
import { AppTable } from "../../shared/ui/AppTable";
import { useState } from "react";
import { ppeApi } from "../../shared/api/ppe";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { Field } from "../../modules/ppe-ui/ppe-ui";
import { employeeName } from "../../modules/ppe-ui/ppe-presentation";
import { EmployeeSizesModal, EmployeeSizeSummary } from "./EmployeeSizesModal";
export function PpeEmployeesPanel() {
  const employees = usePpeQuery("ppe-employees", (signal) =>
    ppeApi.employees(signal),
  );
  const [search, setSearch] = useState("");
  const [id, setId] = useState<number | null>(null);
  const filtered = employees.data?.filter((item) =>
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
        <Field label="Поиск сотрудника">
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <PpeQueryState {...employees} />
        {filtered &&
          (filtered.length ? (
            <div className="ppe-table-wrap">
              <AppTable>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Должность</th>
                    <th>Размеры</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className={!item.isActive ? "ppe-inactive" : undefined}
                    >
                      <td>
                        {employeeName(item)}
                        {!item.isActive && " (отключён)"}
                      </td>
                      <td>{item.position}</td>
                      <td>
                        <EmployeeSizeSummary employee={item} />
                      </td>
                      <td>
                        <button
                          className="admin-secondary-button"
                          onClick={() => setId(item.id)}
                        >
                          Размеры
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
