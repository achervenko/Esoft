import type { ChecklistTemplateFormItem } from "./maintenance-setting-form-utils";

type ChecklistTemplateUpdate = Partial<
  Pick<ChecklistTemplateFormItem, "checklistTemplateId" | "isRequired">
>;

type MaintenanceChecklistTemplatesFieldProps = {
  error?: string;
  items: ChecklistTemplateFormItem[];
  onAdd: () => void;
  onMove: (clientId: string, direction: -1 | 1) => void;
  onRemove: (clientId: string) => void;
  onUpdate: (clientId: string, value: ChecklistTemplateUpdate) => void;
};

export function MaintenanceChecklistTemplatesField({
  error,
  items,
  onAdd,
  onMove,
  onRemove,
  onUpdate,
}: MaintenanceChecklistTemplatesFieldProps) {
  return (
    <fieldset
      className={`maintenance-checklist-templates${error ? " has-error" : ""}`}
    >
      <legend>Шаблоны чек-листов</legend>
      <div>
        {items.length === 0 ? (
          <p className="maintenance-checklist-empty">Не назначены</p>
        ) : null}
        {items.map((template, index) => (
          <div
            className="maintenance-checklist-template-row"
            key={template.clientId}
          >
            <label className="form-field">
              <span>ID шаблона</span>
              <input
                inputMode="numeric"
                onChange={(event) =>
                  onUpdate(template.clientId, {
                    checklistTemplateId: event.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="ID"
                value={template.checklistTemplateId}
              />
            </label>
            <label className="maintenance-settings-checkbox">
              <input
                checked={template.isRequired}
                onChange={(event) =>
                  onUpdate(template.clientId, {
                    isRequired: event.target.checked,
                  })
                }
                type="checkbox"
              />
              Обязательный
            </label>
            <div className="maintenance-checklist-template-actions">
              <button
                disabled={index === 0}
                onClick={() => onMove(template.clientId, -1)}
                type="button"
              >
                Выше
              </button>
              <button
                disabled={index === items.length - 1}
                onClick={() => onMove(template.clientId, 1)}
                type="button"
              >
                Ниже
              </button>
              <button
                className="maintenance-checklist-remove"
                onClick={() => onRemove(template.clientId)}
                type="button"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
      {error ? <small className="field-error">{error}</small> : null}
      <button className="maintenance-checklist-add" onClick={onAdd} type="button">
        Добавить шаблон
      </button>
    </fieldset>
  );
}
