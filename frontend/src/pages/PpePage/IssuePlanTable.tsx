import type { PpePlan, PlanRow } from "../../shared/api/ppe";
import { AppTable } from "../../shared/ui/AppTable";
import { Checkbox } from "../../shared/ui/Checkbox";
import {
  formatPpeQuantity,
  formatPpePeriod,
  sizeLabel,
} from "../../modules/ppe-ui/ppe-presentation";

type IssuePlanTableProps = {
  plan: PpePlan;
  dueItems: PlanRow[];
  allowed: boolean;
  selected: number[];
  hasSelection: boolean;
  onChoose: (row: PlanRow, checked: boolean) => void;
  onIssue: () => void;
};
export function IssuePlanTable({
  plan,
  dueItems,
  allowed,
  selected,
  hasSelection,
  onChoose,
  onIssue,
}: IssuePlanTableProps) {
  return (
    <section className="ppe-plan-section">
      {!plan.norm ? (
        <p className="admin-state">
          На эту дату для должности нет действующей нормы.
          {allowed && " Доступна дополнительная выдача."}
        </p>
      ) : !plan.items.length ? (
        <p className="admin-state">В действующей норме нет позиций.</p>
      ) : (
        <div className="ppe-table-wrap">
          <AppTable className="ppe-plan-table">
            <thead>
              <tr>
                {allowed && <th>Выбрать</th>}
                <th>Название</th>
                <th>Периодичность</th>
                <th>Количество</th>
                <th>Состояние</th>
                <th>Размер</th>
              </tr>
            </thead>
            <tbody>
              {dueItems.map((row) => (
                <tr key={row.normItemId}>
                  {allowed && (
                    <td>
                      <Checkbox
                        label={
                          <span className="ppe-visually-hidden">{`Выбрать ${row.name}`}</span>
                        }
                        checked={selected.includes(row.normItemId)}
                        disabled={!allowed || !row.available}
                        onChange={(checked) => onChoose(row, checked)}
                      />
                    </td>
                  )}
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>
                    {formatPpeQuantity(row.normQuantity, row.unit)} /{" "}
                    {formatPpePeriod(row.periodCount, row.periodUnit)}
                  </td>
                  <td>
                    {row.available
                      ? formatPpeQuantity(row.available.quantity, row.unit)
                      : "—"}
                  </td>
                  <td>
                    <span
                      className={`ppe-badge ${row.overdue ? "ppe-warn" : row.available ? "ppe-good" : "ppe-muted"}`}
                    >
                      {row.available
                        ? row.overdue
                          ? "Просрочено"
                          : "К выдаче"
                        : row.nextFuture
                          ? "Не наступил срок"
                          : row.fulfilledPortions > 0
                            ? "Выдано"
                            : "Нет выдачи"}
                    </span>
                  </td>
                  <td>
                    {row.type === "OTHER"
                      ? "Без размера"
                      : row.sizes.recommendedSizeId
                        ? sizeLabel(
                            row.sizes.recommendedSizeValue,
                            row.sizes.recommendedHeightValue,
                          )
                        : row.sizes.requiresSelection
                          ? row.sizes.activeSizes.length
                            ? "Размер не выбран"
                            : "Нет активных размеров"
                          : "Без размера"}
                  </td>
                </tr>
              ))}
            </tbody>
          </AppTable>
        </div>
      )}
      {allowed && hasSelection && (
        <div className="ppe-actions ppe-issue-actions">
          <button className="admin-primary-button" onClick={onIssue}>
            Выдать
          </button>
        </div>
      )}
    </section>
  );
}
