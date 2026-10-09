import { FormField } from "../../shared/ui/FormField";
import type { EquipmentFieldsProps } from "./model/equipment-fields.types";

export function EquipmentNotesFields({
  fieldErrors,
  form,
  onChange,
  onFieldFocus,
}: EquipmentFieldsProps) {
  return (
    <>
      <FormField
        label="Технологическая операция"
        error={fieldErrors.operationText}
        className="form-field-wide"
      >
        <textarea
          onChange={(event) => onChange("operationText", event.target.value)}
          onFocus={() => onFieldFocus("operationText")}
          rows={5}
          value={form.operationText}
        />
      </FormField>

      <FormField
        label="Примечание"
        error={fieldErrors.notes}
        className="form-field-wide"
      >
        <textarea
          onChange={(event) => onChange("notes", event.target.value)}
          onFocus={() => onFieldFocus("notes")}
          rows={5}
          value={form.notes}
        />
      </FormField>
    </>
  );
}
