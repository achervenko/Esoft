import {
  SelectDropdown,
  type SelectDropdownOption,
} from "../../shared/ui/SelectDropdown";
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
  const checklistTemplateDropdownOptions = checklistTemplateOptions.map(
    (template) => ({
      label: template.name,
      value: String(template.id),
    }),
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
          const options: SelectDropdownOption[] =
            hasSelectedTemplateInActiveOptions || !selectedTemplateId
              ? checklistTemplateDropdownOptions
              : [
                ...checklistTemplateDropdownOptions,
                {
                  disabled: true,
                  label: `Шаблон #${selectedTemplateId} (архивный)`,
                  value: selectedTemplateId,
                },
              ];

          return (
            <div
              className="equipment-event-checklist-assignment"
              key={user.id}
            >
              <span
                className="equipment-event-checklist-assignment__responsible"
                title={user.name}
              >
                {formatResponsibleName(user.name)}
              </span>
              <div className="equipment-event-checklist-assignment__select">
                <SelectDropdown
                  onChange={(checklistTemplateId) =>
                    onAssign(user.id, checklistTemplateId)
                  }
                  options={options}
                  placeholder="Выберите шаблон"
                  required
                  value={selectedTemplateId}
                />
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function formatResponsibleName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const [lastName, firstName, middleName] = parts;
  const initials = [firstName, middleName]
    .filter(Boolean)
    .map((part) => `${part[0]}.`)
    .join("");

  return initials ? `${lastName} ${initials}` : lastName;
}
