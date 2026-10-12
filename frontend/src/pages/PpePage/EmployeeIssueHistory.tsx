import { AppTable } from "../../shared/ui/AppTable";
import { useEffect, useState } from "react";
import { PageNavigation } from "../../shared/ui/PageNavigation";
import { ChevronRight } from "lucide-react";
import { ppeApi } from "../../shared/api/ppe";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { IssueDetailsModal } from "./IssueDetailsModal";
import {
  formatPpeDate,
  formatPpeQuantity,
  sizeLabel,
} from "../../modules/ppe-ui/ppe-presentation";

export function EmployeeIssueHistory({
  employeeId,
  role,
  revision,
  onChanged,
}: {
  employeeId: number;
  role: string | null;
  revision: number;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [selection, setSelection] = useState({ employeeId, page: 0 });
  const page = selection.employeeId === employeeId ? selection.page : 0;
  const setPage = (page: number) => setSelection({ employeeId, page });
  const history = usePpeQuery(
    `employee-history:${employeeId}:${revision}:${page}`,
    (signal) => ppeApi.journal({ employeeId: String(employeeId), page: String(page + 1), limit: '100' }, signal),
    open,
  );
  useEffect(() => {
    if (history.data && page > 0 && page * 100 >= history.data.total) setSelection({ employeeId, page: Math.max(0, Math.ceil(history.data.total / 100) - 1) });
  }, [history.data, page, employeeId]);
  return (
    <details
      className="ppe-employee-section ppe-employee-sizes"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <ChevronRight size={16} aria-hidden="true" />
        История выдачи
      </summary>
      {open && (
        <>
          <PpeQueryState {...history} />
          {history.data &&
            (history.data.items.length ? (
              <div className="ppe-table-wrap">
                <AppTable>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>СИЗ</th>
                      <th>Количество</th>
                      <th>Размер</th>
                      <th>Статус</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.items
                      .map((issue) => (
                        <tr key={issue.id}>
                          <td>{formatPpeDate(issue.issuedAt)}</td>
                          <td>{issue.name}</td>
                          <td>
                            {formatPpeQuantity(issue.quantity, issue.unit)}
                          </td>
                          <td>
                            {sizeLabel(issue.sizeValue, issue.clothingHeight)}
                          </td>
                          <td>
                            {issue.status === "ISSUED" ? "Выдано" : "Отменено"}
                          </td>
                          <td>
                            <button
                              className="admin-secondary-button"
                              onClick={() => setDetail(issue.id)}
                            >
                              Подробнее
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </AppTable>
              </div>
            ) : (
              <p className="admin-state">Выдач пока нет.</p>
            ))}
          {history.data && !history.error ? <PageNavigation page={page} pageSize={100} total={history.data.total} loading={history.loading} onChange={setPage} /> : null}
        </>
      )}
      {detail !== null && (
        <IssueDetailsModal
          id={detail}
          role={role}
          onClose={() => setDetail(null)}
          onChanged={() => {
            history.reload();
            onChanged();
          }}
        />
      )}
    </details>
  );
}
