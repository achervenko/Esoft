import type { EquipmentEventDetail } from "../../shared/api/equipment-events/equipment-events.types";
import { AdminModal } from "../../shared/ui/AdminModal";
import {
  equipmentEventExecutionTypeLabels,
  equipmentEventSourceLabels,
  equipmentEventStatusLabels,
  formatDateValue,
  formatEventResponsibles,
} from "./equipment-events-utils";

type EquipmentEventDetailModalProps = {
  event: EquipmentEventDetail;
  onClose: () => void;
};

export function EquipmentEventDetailModal({
  event,
  onClose,
}: EquipmentEventDetailModalProps) {
  return (
    <AdminModal onClose={onClose} title="Событие оборудования">
      <div className="equipment-event-detail">
        <dl>
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
            <dt>Фактическая дата</dt>
            <dd>{formatDateValue(event.factDate)}</dd>
          </div>
          <div>
            <dt>Способ выполнения</dt>
            <dd>{equipmentEventExecutionTypeLabels[event.executionType]}</dd>
          </div>
          <div>
            <dt>Шаблон чек-листа</dt>
            <dd>
              {event.checklistTemplateId
                ? `#${event.checklistTemplateId}`
                : "Не указан"}
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
      </div>
    </AdminModal>
  );
}
