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

      <FormField
        label="Название оборудования"
        error={fieldErrors.name}
        required
        className="form-field-wide"
      >
        <input
          onChange={(event) => onChange("name", event.target.value)}
          onFocus={() => onFieldFocus("name")}
          type="text"
          value={form.name}
        />
      </FormField>

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
        placeholder={
          form.manufacturerId
            ? "Выберите модель"
            : "Сначала выберите производителя"
        }
        required
        value={form.modelId}
      />

      <FormField
        label="Технические характеристики"
        error={fieldErrors.specifications}
        className="form-field-wide"
      >
        <textarea
          onChange={(event) => onChange("specifications", event.target.value)}
          onFocus={() => onFieldFocus("specifications")}
          rows={5}
          value={form.specifications}
        />
      </FormField>

      <FormField label="Заводской номер" error={fieldErrors.serialNumber}>
        <input
          onChange={(event) => onChange("serialNumber", event.target.value)}
          onFocus={() => onFieldFocus("serialNumber")}
          type="text"
          value={form.serialNumber}
        />
      </FormField>

      <FormField
        label="Инвентарный номер"
        error={fieldErrors.inventoryNumber}
        required
      >
        <input
          onChange={(event) => onChange("inventoryNumber", event.target.value)}
          onFocus={() => onFieldFocus("inventoryNumber")}
          type="text"
          value={form.inventoryNumber}
        />
      </FormField>
    </>
  );
}
