import type { PpePlan, PlanRow } from "../../shared/api/ppe";
import { AppTable } from "../../shared/ui/AppTable";
import { Checkbox } from "@chakra-ui/react";
import {
  formatPpeQuantity,
  formatPpePeriod,
  formatPpeDate,
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
      {plan.warnings?.map((warning) => <p className="admin-state" role="status" key={warning.positionId}>{warning.message}</p>)}
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
                {allowed && <th className="ppe-plan-selection-column" aria-label="Выбрать" />}
                <th>Артикул</th>
                <th className="ppe-plan-name-column">Название</th>
                <th>Периодичность</th>
                <th>Количество</th>
                <th>Состояние</th>
                <th>Плановая дата</th>
                <th>Размер</th>
              </tr>
            </thead>
            <tbody>
              {dueItems.map((row) => (
                <tr key={row.normItemId}>
                  {allowed && (
                    <td className="ppe-plan-selection-column">
                      <Checkbox.Root
                        className="ppe-plan-checkbox"
                        checked={selected.includes(row.normItemId)}
                        disabled={!allowed || !row.available}
                        onCheckedChange={({ checked }) => onChoose(row, checked === true)}
                      >
                        <Checkbox.HiddenInput aria-label={`Выбрать ${row.name}`} />
                        <Checkbox.Control />
                      </Checkbox.Root>
                    </td>
                  )}
                  <td>{row.article}</td>
                  <td className="ppe-plan-name-column">
                    <strong>{row.name}</strong>
                    {row.normEffectiveFrom > plan.on && (
                      <small className="ppe-plan-available-from">Норма с {formatPpeDate(row.normEffectiveFrom)}</small>
                    )}
                  </td>
                  <td>
                    {formatPpeQuantity(row.normQuantity, row.unit)} /{" "}
                    {formatPpePeriod(row.periodCount, row.periodUnit)}
                  </td>
                  <td>
                    {formatPpeQuantity(row.available?.quantity ?? row.normQuantity, row.unit)}
                  </td>
                  <td>
                    <span
                      className={`ppe-badge ${row.overdue ? "ppe-warn" : row.available ? "ppe-good" : "ppe-muted"}`}
                    >
                      {row.available
                        ? row.overdue
                          ? "Просрочено"
                          : row.obligationStatus === "EARLY"
                            ? "Можно выдать"
                            : "К выдаче"
                        : row.nextFuture
                          ? "Ещё рано"
                          : row.obligationStatus === "FINISHED"
                            ? "Норма завершена"
                            : "Нет выдачи"}
                    </span>
                  </td>
                  <td>
                    {formatPpeDate(row.plannedDate)}
                    {row.availableFrom && <small className="ppe-plan-available-from">Можно выдать с {formatPpeDate(row.availableFrom)}</small>}
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
      {allowed && (
        <div
          className={`ppe-plan-confirm-reveal${hasSelection ? " is-visible" : ""}`}
          aria-hidden={!hasSelection}
          inert={!hasSelection}
        >
          <div className="ppe-plan-confirm-clip">
            <div className="ppe-actions ppe-issue-actions">
              <button type="button" className="admin-primary-button" onClick={onIssue} disabled={!hasSelection}>
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
