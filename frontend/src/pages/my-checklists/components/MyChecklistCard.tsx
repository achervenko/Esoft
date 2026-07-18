import { checklistStatusLabels } from "../my-checklists.config";
import { formatDate, formatProgress } from "../my-checklists.utils";
import type { MyChecklistCardProps } from "../my-checklists.types";

export function MyChecklistCard({
  currentUserId,
  item,
  onOpen,
  onStart,
}: MyChecklistCardProps) {
  const isAssignedToCurrentUser = item.assignedUser.id === currentUserId;
  const primaryActionLabel =
    item.status === "CREATED" && isAssignedToCurrentUser
      ? "Начать"
      : item.status === "IN_PROGRESS" && isAssignedToCurrentUser
        ? "Продолжить"
        : "Просмотреть";

  return (
    <article className="my-checklists-item">
      <header>
        <strong>{item.template.name}</strong>
        <span className={`my-checklists-status ${item.status.toLowerCase()}`}>
          {checklistStatusLabels[item.status]}
        </span>
      </header>

      <dl>
        <div>
          <dt>Исполнитель</dt>
          <dd>{item.assignedUser.fullName}</dd>
        </div>
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
        <button
          className="admin-secondary-button"
          onClick={() =>
            item.status === "CREATED" && isAssignedToCurrentUser
              ? onStart(item)
              : onOpen(item.id)
          }
          type="button"
        >
          {primaryActionLabel}
        </button>
      </div>
    </article>
  );
}
