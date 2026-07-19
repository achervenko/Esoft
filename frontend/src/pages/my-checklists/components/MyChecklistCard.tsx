import { formatDate, formatProgress } from "../my-checklists.utils";
import type { MyChecklistCardProps } from "../my-checklists.types";

export function MyChecklistCard({
  href,
  isStarting,
  item,
  onStart,
}: MyChecklistCardProps) {
  const primaryActionLabel =
    item.status === "CREATED"
      ? "Начать"
      : item.status === "IN_PROGRESS"
        ? "Продолжить"
        : "Просмотреть";
  const isStartAction = item.status === "CREATED";

  return (
    <article className="my-checklists-item">
      <header>
        <strong>{item.template.name}</strong>
      </header>

      <dl>
        <div>
          <dt>Оборудование</dt>
          <dd>
            ID {item.equipment.visibleId} - {item.equipment.name}
          </dd>
        </div>
        <div>
          <dt>Модель</dt>
          <dd>{item.equipment.model.name}</dd>
        </div>
        <div>
          <dt>Вид обслуживания</dt>
          <dd>{item.event.maintenanceType.name}</dd>
        </div>
        <div>
          <dt>Плановая дата</dt>
          <dd>{formatDate(item.event.plannedDate)}</dd>
        </div>
        <div>
          <dt>Прогресс</dt>
          <dd>{formatProgress(item.progress)}</dd>
        </div>
      </dl>

      <div className="my-checklists-item-actions">
        {isStartAction ? (
          <button
            className="admin-secondary-button"
            disabled={isStarting}
            onClick={() => onStart(item)}
            type="button"
          >
            {primaryActionLabel}
          </button>
        ) : (
          <a className="admin-secondary-button" href={href}>
            {primaryActionLabel}
          </a>
        )}
      </div>
    </article>
  );
}
