import { formatDate, formatDateTime, formatProgress } from "../my-checklists.utils";
import type { ChecklistSummaryProps } from "../my-checklists.types";

export function ChecklistSummary({ checklist }: ChecklistSummaryProps) {
  return (
    <section className="my-checklists-detail-summary">
      <dl>
        <div>
          <dt>Оборудование</dt>
          <dd>
            ID {checklist.equipment.visibleId} - {checklist.equipment.name}
          </dd>
        </div>
        <div>
          <dt>Модель</dt>
          <dd>{checklist.equipment.model.name}</dd>
        </div>
        <div>
          <dt>Плановая дата</dt>
          <dd>{formatDate(checklist.event.plannedDate)}</dd>
        </div>
        <div>
          <dt>Прогресс</dt>
          <dd>{formatProgress(checklist.progress)}</dd>
        </div>
        <div>
          <dt>Начат</dt>
          <dd>{formatDateTime(checklist.startedAt)}</dd>
        </div>
        <div>
          <dt>Завершён</dt>
          <dd>{formatDateTime(checklist.completedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
