import { FormField } from "../../shared/ui/FormField";
import { SearchSelect } from "../../shared/ui/SearchSelect";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { formatRuDate } from "./model/equipment-create-form.formatters";
import type { EquipmentCreateOptions } from "../../shared/api/equipment/equipment.types";
import type { EquipmentFieldsProps } from "./model/equipment-fields.types";

export function EquipmentDetailsFields({
  fieldErrors,
  form,
  onChange,
  onFieldFocus,
  options,
}: EquipmentFieldsProps & { options: EquipmentCreateOptions }) {
  return (
    <>
      <SearchSelect
        label="Страна производства"
        error={fieldErrors.countryId}
        onChange={(value) => onChange("countryId", value)}
        onFocus={() => onFieldFocus("countryId")}
        options={options.countries}
        value={form.countryId}
      />

      <FormField label="Год выпуска" error={fieldErrors.manufactureYear}>
        <input
          inputMode="numeric"
          maxLength={4}
          onChange={(event) =>
            onChange(
              "manufactureYear",
              event.target.value.replace(/\D/g, "").slice(0, 4),
            )
          }
          onFocus={() => onFieldFocus("manufactureYear")}
          type="text"
          value={form.manufactureYear}
        />
      </FormField>

      <FormField
        label="Дата ввода в эксплуатацию"
        error={fieldErrors.commissioningDate}
      >
        <input
          inputMode="numeric"
          onChange={(event) =>
            onChange("commissioningDate", formatRuDate(event.target.value))
          }
          onFocus={() => onFieldFocus("commissioningDate")}
          placeholder="ДД.ММ.ГГГГ"
          type="text"
          value={form.commissioningDate}
        />
      </FormField>

      <SearchSelect
        label="Местонахождение"
        error={fieldErrors.sectionId}
        onChange={(value) => onChange("sectionId", value)}
        onFocus={() => onFieldFocus("sectionId")}
        options={options.sections}
        required
        value={form.sectionId}
      />

      <SearchSelect
        label="Ответственный"
        error={fieldErrors.responsibleEmployeeId}
        onChange={(value) => onChange("responsibleEmployeeId", value)}
        onFocus={() => onFieldFocus("responsibleEmployeeId")}
        options={options.employees}
        required
        value={form.responsibleEmployeeId}
      />

      <FormField label="Дата выдачи" error={fieldErrors.issueDate} required>
        <input
          inputMode="numeric"
          onChange={(event) =>
            onChange("issueDate", formatRuDate(event.target.value))
          }
          onFocus={() => onFieldFocus("issueDate")}
          placeholder="ДД.ММ.ГГГГ"
          type="text"
          value={form.issueDate}
        />
      </FormField>

      <SelectDropdown
        label="Статус"
        error={fieldErrors.status}
        onChange={(value) => onChange("status", value)}
        onFocus={() => onFieldFocus("status")}
        options={options.statuses}
        placeholder="Выберите статус"
        required
        value={form.status}
      />
    </>
  );
}
