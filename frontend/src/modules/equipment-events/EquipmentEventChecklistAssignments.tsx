import type { MaintenanceSettingChecklistTemplate } from "../../shared/api/maintenance/maintenance.types";
import type { ResponsibleUserOption } from "./equipment-event-form.types";

type EquipmentEventChecklistAssignmentsProps = {
  checklistAssignees: Record<number, string>;
  checklistTemplates: MaintenanceSettingChecklistTemplate[];
  onAssign: (checklistTemplateId: number, responsibleUserId: string) => void;
  responsibleUserIds: string[];
  users: ResponsibleUserOption[];
};

export function EquipmentEventChecklistAssignments({
  checklistAssignees,
  checklistTemplates,
  onAssign,
  responsibleUserIds,
  users,
}: EquipmentEventChecklistAssignmentsProps) {
  const selectedResponsibleOptions = users.filter((user) =>
    responsibleUserIds.includes(user.id),
  );
  const sortedChecklistTemplates = [...checklistTemplates].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.checklistTemplateId - right.checklistTemplateId,
  );

  if (sortedChecklistTemplates.length === 0) {
    return null;
  }

  return (
    <fieldset className="equipment-event-responsibles">
      <legend>Исполнители чек-листов</legend>
      <div>
        {sortedChecklistTemplates.map((checklistTemplate) => (
          <label key={checklistTemplate.checklistTemplateId}>
            <span>
              {checklistTemplate.name ??
                `Шаблон #${checklistTemplate.checklistTemplateId}`}{" "}
              -{" "}
              {checklistTemplate.isRequired
                ? "обязательный"
                : "необязательный"}
            </span>
            <select
              onChange={(selectEvent) =>
                onAssign(
                  checklistTemplate.checklistTemplateId,
                  selectEvent.target.value,
                )
              }
              value={
                checklistAssignees[checklistTemplate.checklistTemplateId] ?? ""
              }
            >
              <option value="">Выберите исполнителя</option>
              {selectedResponsibleOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
