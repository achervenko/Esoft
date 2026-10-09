import { AppTable } from "../../shared/ui/AppTable";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { ppeApi } from "../../shared/api/ppe";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import {
  businessToday,
  formatPpeDate,
  formatPpePeriod,
  formatPpeQuantity,
} from "../../modules/ppe-ui/ppe-presentation";

export function EmployeeNorms({
  positionId,
  revision,
}: {
  positionId: number;
  revision: number;
}) {
  const [open, setOpen] = useState(false);
  const norms = usePpeQuery(
    `employee-norms:${positionId}:${revision}`,
    (signal) => ppeApi.norms(String(positionId), signal),
    open,
  );
  return (
    <details
      className="ppe-employee-section ppe-employee-sizes"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <ChevronRight size={16} aria-hidden="true" />
        Нормы
      </summary>
      {open && (
        <>
          <PpeQueryState {...norms} />
          {norms.data &&
            (!norms.data.length ? (
              <p className="admin-state">Нормы не заданы.</p>
            ) : (
              [...norms.data]
                .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
                .map((norm) => (
                  <section className="ppe-form" key={norm.id}>
                    <div className="ppe-actions">
                      <span>
                        {norm.effectiveFrom <= businessToday() &&
                        (!norm.effectiveTo ||
                          norm.effectiveTo >= businessToday())
                          ? `с ${formatPpeDate(norm.effectiveFrom)}`
                          : `${formatPpeDate(norm.effectiveFrom)} — ${norm.effectiveTo ? formatPpeDate(norm.effectiveTo) : "без даты окончания"}`}
                      </span>
                    </div>
                    <div className="ppe-table-wrap">
                      <AppTable>
                        <thead>
                          <tr>
                            <th>Название</th>
                            <th>Количество</th>
                            <th>Период</th>
                          </tr>
                        </thead>
                        <tbody>
                          {norm.items.map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td>
                                {formatPpeQuantity(item.quantity, item.unit)}
                              </td>
                              <td>
                                {formatPpePeriod(
                                  item.periodCount,
                                  item.periodUnit,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </AppTable>
                    </div>
                  </section>
                ))
            ))}
        </>
      )}
    </details>
  );
}
