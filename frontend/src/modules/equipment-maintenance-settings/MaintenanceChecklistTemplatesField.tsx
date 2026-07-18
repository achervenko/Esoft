import type { ChecklistTemplateFormItem } from "./maintenance-setting-form-utils";
import { Checkbox } from "../../shared/ui/Checkbox";
import { SelectDropdown, type SelectDropdownOption } from "../../shared/ui/SelectDropdown";

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
  options: SelectDropdownOption[];
};

export function MaintenanceChecklistTemplatesField({
  error,
  items,
  onAdd,
  onMove,
  onRemove,
  onUpdate,
  options,
}: MaintenanceChecklistTemplatesFieldProps) {
  const selectedTemplateIds = new Set(
    items
      .map((item) => item.checklistTemplateId)
      .filter((templateId) => templateId.trim()),
  );

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
          <TemplateRow
            index={index}
            item={template}
            itemsCount={items.length}
            key={template.clientId}
            onMove={onMove}
            onRemove={onRemove}
            onUpdate={onUpdate}
            options={options.filter(
              (option) =>
                option.value === template.checklistTemplateId ||
                !selectedTemplateIds.has(option.value),
            )}
          />
        ))}
      </div>
      {error ? <small className="field-error">{error}</small> : null}
      <button className="maintenance-checklist-add" onClick={onAdd} type="button">
        Добавить шаблон
      </button>
    </fieldset>
  );
}

function TemplateRow({
  index,
  item,
  itemsCount,
  onMove,
  onRemove,
  onUpdate,
  options,
}: {
  index: number;
  item: ChecklistTemplateFormItem;
  itemsCount: number;
  onMove: (clientId: string, direction: -1 | 1) => void;
  onRemove: (clientId: string) => void;
  onUpdate: (clientId: string, value: ChecklistTemplateUpdate) => void;
  options: SelectDropdownOption[];
}) {
  const selectedTemplateName =
    options.find((option) => option.value === item.checklistTemplateId)?.label ??
    "не выбранный шаблон";

  return (
    <div className="maintenance-checklist-template-row">
      <SelectDropdown
        label="Шаблон"
        onChange={(value) =>
          onUpdate(item.clientId, {
            checklistTemplateId: value,
          })
        }
        options={options}
        placeholder="Выберите шаблон"
        value={item.checklistTemplateId}
      />
      <Checkbox
        checked={item.isRequired}
        label="Обязательный"
        onChange={(checked) =>
          onUpdate(item.clientId, {
            isRequired: checked,
          })
        }
      />
      <div className="maintenance-checklist-template-actions">
        <button
          aria-label={`Переместить выше: ${selectedTemplateName}`}
          disabled={index === 0}
          onClick={() => onMove(item.clientId, -1)}
          type="button"
        >
          Выше
        </button>
        <button
          aria-label={`Переместить ниже: ${selectedTemplateName}`}
          disabled={index === itemsCount - 1}
          onClick={() => onMove(item.clientId, 1)}
          type="button"
        >
          Ниже
        </button>
        <button
          aria-label={`Удалить: ${selectedTemplateName}`}
          className="maintenance-checklist-remove"
          onClick={() => onRemove(item.clientId)}
          type="button"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
