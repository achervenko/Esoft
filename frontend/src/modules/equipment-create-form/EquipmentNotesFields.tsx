import { TextareaField } from "../../shared/ui/TextField";
import type { EquipmentFieldsProps } from "./model/equipment-fields.types";

export function EquipmentNotesFields({
  fieldErrors,
  form,
  onChange,
  onFieldFocus,
}: EquipmentFieldsProps) {
  return (
    <>
      <TextareaField
        label="Технологическая операция"
        error={fieldErrors.operationText}
        fieldClassName="form-field-wide"
        onChange={(value) => onChange("operationText", value)}
        onFocus={() => onFieldFocus("operationText")}
        rows={5}
        value={form.operationText}
      />

      <TextareaField
        label="Примечание"
        error={fieldErrors.notes}
        fieldClassName="form-field-wide"
        onChange={(value) => onChange("notes", value)}
        onFocus={() => onFieldFocus("notes")}
        rows={5}
        value={form.notes}
      />
    </>
  );
}
