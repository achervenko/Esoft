import type { ChecklistTemplateListItem } from "../../shared/api/checklists";
import type { ResponsibleUserOption } from "./equipment-event-form.types";

type EquipmentEventChecklistAssignmentsProps = {
  checklistTemplateIdByResponsible: Record<string, string>;
  checklistTemplateOptions: ChecklistTemplateListItem[];
  onAssign: (responsibleUserId: string, checklistTemplateId: string) => void;
  responsibleUserIds: string[];
  users: ResponsibleUserOption[];
};

export function EquipmentEventChecklistAssignments({
  checklistTemplateIdByResponsible,
  checklistTemplateOptions,
  onAssign,
  responsibleUserIds,
  users,
}: EquipmentEventChecklistAssignmentsProps) {
  const selectedResponsibleOptions = users.filter((user) =>
    responsibleUserIds.includes(user.id),
  );

  if (selectedResponsibleOptions.length === 0) {
    return null;
  }

  return (
    <fieldset className="equipment-event-responsibles">
      <legend>Шаблоны чек-листов</legend>
      <div>
        {selectedResponsibleOptions.map((user) => {
          const selectedTemplateId =
            checklistTemplateIdByResponsible[user.id] ?? "";
          const hasSelectedTemplateInActiveOptions = checklistTemplateOptions.some(
            (template) => String(template.id) === selectedTemplateId,
          );
          const options = hasSelectedTemplateInActiveOptions || !selectedTemplateId
            ? checklistTemplateOptions
            : [
                ...checklistTemplateOptions,
                {
                  id: Number(selectedTemplateId),
                  name: `Шаблон #${selectedTemplateId} (архивный)`,
                },
              ];

          return (
            <label key={user.id}>
              <span>{user.name}</span>
              <select
                onChange={(selectEvent) =>
                  onAssign(user.id, selectEvent.target.value)
                }
                value={selectedTemplateId}
              >
                <option value="">Выберите шаблон</option>
                {options.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
