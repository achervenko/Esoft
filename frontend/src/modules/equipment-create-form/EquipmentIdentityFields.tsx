import { TextField, TextareaField } from "../../shared/ui/TextField";
import { FormField } from "../../shared/ui/FormField";
import { SearchSelect } from "../../shared/ui/SearchSelect";
import type { EquipmentCreateOptions } from "../../shared/api/equipment/equipment.types";
import type { EquipmentFieldsProps } from "./model/equipment-fields.types";

type EquipmentIdentityFieldsProps = EquipmentFieldsProps & {
  options: EquipmentCreateOptions;
  modelOptions: EquipmentCreateOptions["models"];
  onManufacturerChange: (value: number | null) => void;
};
export function EquipmentIdentityFields({
  fieldErrors,
  form,
  onChange,
  onFieldFocus,
  options,
  modelOptions,
  onManufacturerChange,
}: EquipmentIdentityFieldsProps) {
  return (
    <>
      <FormField
        label="ID"
        error={fieldErrors.visibleId}
        className="form-field-small"
      >
        <input
          inputMode="numeric"
          onChange={(event) =>
            onChange("visibleId", event.target.value.replace(/\D/g, ""))
          }
          onFocus={() => onFieldFocus("visibleId")}
          placeholder="Авто"
          type="text"
          value={form.visibleId}
        />
      </FormField>

      <TextField
        label="Название оборудования"
        error={fieldErrors.name}
        required
        fieldClassName="form-field-wide"
        onChange={(value) => onChange("name", value)}
        onFocus={() => onFieldFocus("name")}
        type="text"
        value={form.name}
      />

      <SearchSelect
        label="Производитель"
        error={fieldErrors.manufacturerId}
        onChange={onManufacturerChange}
        onFocus={() => onFieldFocus("manufacturerId")}
        options={options.manufacturers}
        required
        value={form.manufacturerId}
      />

      <SearchSelect
        label="Модель"
        error={fieldErrors.modelId}
        onChange={(value) => onChange("modelId", value)}
        onFocus={() => onFieldFocus("modelId")}
        options={modelOptions}
        required
        value={form.modelId}
      />

      <TextareaField
        label="Технические характеристики"
        error={fieldErrors.specifications}
        fieldClassName="form-field-wide"
        onChange={(value) => onChange("specifications", value)}
        onFocus={() => onFieldFocus("specifications")}
        rows={5}
        value={form.specifications}
      />

      <TextField
        label="Заводской номер"
        error={fieldErrors.serialNumber}
        onChange={(value) => onChange("serialNumber", value)}
        onFocus={() => onFieldFocus("serialNumber")}
        type="text"
        value={form.serialNumber}
      />

      <TextField
        label="Инвентарный номер"
        error={fieldErrors.inventoryNumber}
        required
        onChange={(value) => onChange("inventoryNumber", value)}
        onFocus={() => onFieldFocus("inventoryNumber")}
        type="text"
        value={form.inventoryNumber}
      />
    </>
  );
}
