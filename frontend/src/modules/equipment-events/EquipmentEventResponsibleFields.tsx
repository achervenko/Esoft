import type { ResponsibleUserOption } from "./equipment-event-form.types";

type EquipmentEventResponsibleFieldsProps = {
  onToggle: (responsibleUserId: string) => void;
  responsibleUserIds: string[];
  users: ResponsibleUserOption[];
};

export function EquipmentEventResponsibleFields({
  onToggle,
  responsibleUserIds,
  users,
}: EquipmentEventResponsibleFieldsProps) {
  return (
    <fieldset className="equipment-event-responsibles">
      <legend>
        Ответственные<b aria-hidden="true">*</b>
      </legend>
      <div>
        {users.map((user) => {
          const isChecked = responsibleUserIds.includes(user.id);

          return (
            <label key={user.id}>
              <input
                checked={isChecked}
                disabled={user.isUnavailable && !isChecked}
                onChange={() => onToggle(user.id)}
                type="checkbox"
              />
              <span>{user.name}</span>
              {user.position ? <small>{user.position}</small> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
