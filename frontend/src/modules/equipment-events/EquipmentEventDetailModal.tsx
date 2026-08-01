import type { EquipmentEventDetail } from "./equipment-events.types";
import { AdminModal } from "../../shared/ui/AdminModal";
import {
  equipmentEventChecklistStatusLabels,
  equipmentEventExecutionTypeLabels,
  equipmentEventSourceLabels,
  equipmentEventStatusLabels,
  formatChecklistProgress,
  formatDateValue,
  formatEventResponsibles,
} from "./equipment-events-utils";
import "./EquipmentEventDetail.css";

type EquipmentEventDetailModalProps = {
  error?: string | null;
  event: EquipmentEventDetail | null;
  isLoading?: boolean;
  onClose: () => void;
};

export function EquipmentEventDetailModal({
  error = null,
  event,
  isLoading = false,
  onClose,
}: EquipmentEventDetailModalProps) {
  return (
    <AdminModal
      className="equipment-event-detail-modal"
      onClose={onClose}
      title="Событие оборудования"
    >
      <div className="equipment-event-detail">
        {isLoading ? (
          <div className="equipment-event-detail-loading" role="status">
            Загрузка события...
          </div>
        ) : null}

        {!isLoading && event === null && error ? (
          <div className="equipment-event-detail-loading" role="alert">
            {error}
          </div>
        ) : null}

        {!isLoading && event !== null ? (
          <>
            <dl>
              <div>
                <dt>Оборудование</dt>
                <dd>
                  ID {event.equipment.visibleId} - {event.equipment.name},{" "}
                  {event.equipment.model.name},{" "}
                  {event.equipment.model.manufacturer.name}
                </dd>
              </div>
              <div>
                <dt>Вид обслуживания</dt>
                <dd>{event.maintenanceType.name}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>{equipmentEventStatusLabels[event.status]}</dd>
              </div>
              <div>
                <dt>Источник создания</dt>
                <dd>{equipmentEventSourceLabels[event.source]}</dd>
              </div>
              <div>
                <dt>Плановая дата</dt>
                <dd>{formatDateValue(event.plannedDate)}</dd>
              </div>
              <div>
                <dt>Первоначальная плановая дата</dt>
                <dd>{formatDateValue(event.originalPlannedDate)}</dd>
              </div>
              <div>
                <dt>Фактическая дата</dt>
                <dd>{formatDateValue(event.factDate)}</dd>
              </div>
              <div>
                <dt>Способ выполнения</dt>
                <dd>{equipmentEventExecutionTypeLabels[event.executionType]}</dd>
              </div>
              <div>
                <dt>Чек-листы</dt>
                <dd>
                  {event.checklists.length > 0 ? (
                    <ul className="equipment-event-detail-checklists">
                      {event.checklists.map((checklist) => (
                        <li key={checklist.id}>
                          <strong>{checklist.assignedUser.fullName}</strong>:{" "}
                          {checklist.templateName},{" "}
                          {equipmentEventChecklistStatusLabels[
                            checklist.status
                          ]}
                          , {formatChecklistProgress(checklist.progress)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "Не назначены"
                  )}
                </dd>
              </div>
              <div>
                <dt>Ответственные</dt>
                <dd>{formatEventResponsibles(event.responsibles)}</dd>
              </div>
              <div>
                <dt>Создал</dt>
                <dd>{event.createdBy.fullName}</dd>
              </div>
              <div>
                <dt>Комментарий</dt>
                <dd>{event.note ?? "Не указан"}</dd>
              </div>
            </dl>

            <div className="admin-form-actions">
              <button
                className="admin-primary-button"
                onClick={onClose}
                type="button"
              >
                Закрыть
              </button>
            </div>
          </>
        ) : null}
      </div>
    </AdminModal>
  );
}
