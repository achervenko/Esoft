import type { PpeNorm } from "../../shared/api/ppe";
import { AppTable } from "../../shared/ui/AppTable";
import {
  formatPpeDate,
  formatPpeQuantity,
  formatPpePeriod,
} from "../../modules/ppe-ui/ppe-presentation";
import { normPeriodStatus, type NormFormState } from "./norm-model";
type NormCardProps = {
  norm: PpeNorm;
  selectedNorms: PpeNorm[];
  manage: boolean;
  positionActive: boolean;
  onForm: (state: NormFormState) => void;
  onLifecycle: (norm: PpeNorm) => void;
};
export function NormCard({
  norm,
  selectedNorms,
  manage,
  positionActive,
  onForm,
  onLifecycle,
}: NormCardProps) {
  return (
    <section className="ppe-norm-card">
      <header>
        <div>
          <p>
            {formatPpeDate(norm.effectiveFrom)} —{" "}
            {norm.effectiveTo
              ? formatPpeDate(norm.effectiveTo)
              : "без даты окончания"}
          </p>
          <span
            className={`ppe-badge ${normPeriodStatus(norm) === "Действующая" ? "ppe-good" : "ppe-muted"}`}
          >
            {normPeriodStatus(norm)}
          </span>
        </div>
        {manage &&
          positionActive &&
          normPeriodStatus(norm) !== "Завершённая" && (
            <div className="ppe-actions">
              {!selectedNorms.some(
                (other) => other.effectiveFrom > norm.effectiveFrom,
              ) && (
                <button
                  className="admin-secondary-button"
                  onClick={() => onForm({ mode: "revision", norm })}
                >
                  Создать новую редакцию
                </button>
              )}
              {normPeriodStatus(norm) === "Будущая" && (
                <button
                  className="admin-secondary-button"
                  onClick={() => onForm({ mode: "edit", norm })}
                >
                  Редактировать
                </button>
              )}
              <button
                className="admin-secondary-button ppe-danger-button"
                onClick={() => onLifecycle(norm)}
              >
                {normPeriodStatus(norm) === "Будущая"
                  ? "Удалить"
                  : "Завершить действие"}
              </button>
            </div>
          )}
      </header>
      <div className="ppe-table-wrap">
        <AppTable>
          <thead>
            <tr>
              <th>Артикул</th>
              <th>Наименование</th>
              <th>Количество</th>
              <th>Период</th>
            </tr>
          </thead>
          <tbody>
            {norm.items.map((item) => (
              <tr
                key={item.id}
                className={!item.isActive ? "ppe-inactive" : undefined}
              >
                <td>{item.article}</td>
                <td>
                  {item.name}
                  {!item.isActive && " (удалён)"}
                </td>
                <td>{formatPpeQuantity(item.quantity, item.unit)}</td>
                <td>
                  {formatPpePeriod(item.periodCount, item.periodUnit)}
                  {item.calculationMode === "MONTHLY" && (
                    <small>Месячный объём</small>
                  )}
                  {item.calculationMode === "INTERVAL" && (
                    <small>По сроку носки</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AppTable>
      </div>
    </section>
  );
}
