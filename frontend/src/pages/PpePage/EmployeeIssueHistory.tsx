import { AppTable } from "../../shared/ui/AppTable";
import { useState } from "react";
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
  const history = usePpeQuery(
    `employee-history:${employeeId}:${revision}`,
    (signal) => ppeApi.journal({ employeeId: String(employeeId) }, signal),
    open,
  );
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
            (history.data.length ? (
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
                    {[...history.data]
                      .sort(
                        (a, b) =>
                          b.issuedAt.localeCompare(a.issuedAt) || b.id - a.id,
                      )
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
