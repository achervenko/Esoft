import { AppTable } from "../../shared/ui/AppTable";
import { useState } from "react";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
import { ChevronRight } from "lucide-react";
import { ppeApi } from "../../shared/api/ppe";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import { IssueDetailsModal } from "./IssueDetailsModal";
import {
  formatPpeDate,
  formatPpeQuantity,
  sizeLabel,
} from "../../modules/ppe-ui/ppe-presentation";

export function EmployeeIssueHistory({
  employeeId,
  permissions,
  revision,
  onChanged,
}: {
  employeeId: number;
  permissions: readonly string[] | null;
  revision: number;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const history = useIncrementalList({
    queryKey: JSON.stringify([employeeId, revision, localRevision]),
    enabled: open,
    getKey: (
      issue: Awaited<ReturnType<typeof ppeApi.journal>>["items"][number],
    ) => issue.id,
    loadPage: (offset, signal) =>
      ppeApi.journal(
        {
          employeeId: String(employeeId),
          page: String(Math.floor(offset / 100) + 1),
          limit: "100",
        },
        signal,
      ),
  });
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
          <PpeQueryState
            loading={history.loading && !history.data}
            error={!history.data ? history.error : null}
            reload={history.retry}
          />
          {history.data &&
            (history.data.items.length ? (
              <div className="ppe-table-wrap">
                <AppTable incremental={false}>
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
                    {history.data.items.map((issue) => (
                      <tr key={issue.id}>
                        <td>{formatPpeDate(issue.issuedAt)}</td>
                        <td>{issue.name}</td>
                        <td>{formatPpeQuantity(issue.quantity, issue.unit)}</td>
                        <td>{sizeLabel(issue.sizeValue, issue.heightValue)}</td>
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
          <ListLoadMore list={history} disabled={detail !== null} />
        </>
      )}
      {detail !== null && (
        <IssueDetailsModal
          id={detail}
          permissions={permissions}
          onClose={() => setDetail(null)}
          onChanged={() => {
            setLocalRevision((value) => value + 1);
            onChanged();
          }}
        />
      )}
    </details>
  );
}
