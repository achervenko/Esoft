import { EquipmentIdentityFields } from "./EquipmentIdentityFields";
import { EquipmentDetailsFields } from "./EquipmentDetailsFields";
import { EquipmentNotesFields } from "./EquipmentNotesFields";
import "./EquipmentForm.css";
import { Save } from "lucide-react";
import type { EquipmentCreateOptions } from "../../shared/api/equipment/equipment.types";
import type {
  EquipmentCreateFieldErrors,
  EquipmentCreateFormState,
} from "./model/equipment-create-form.types";

type EquipmentCreateFormProps = {
  fieldErrors: EquipmentCreateFieldErrors;
  form: EquipmentCreateFormState;
  isSubmitting: boolean;
  onChange: <Key extends keyof EquipmentCreateFormState>(
    key: Key,
    value: EquipmentCreateFormState[Key],
  ) => void;
  onFieldFocus: (key: keyof EquipmentCreateFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  options: EquipmentCreateOptions;
  submitLabel?: string;
  submittingLabel?: string;
};

export function EquipmentCreateForm({
  fieldErrors,
  form,
  isSubmitting,
  onChange,
  onFieldFocus,
  onSubmit,
  options,
  submitLabel = "Сохранить",
  submittingLabel = "Сохранение...",
}: EquipmentCreateFormProps) {
  const fields = { fieldErrors, form, onChange, onFieldFocus };
  const modelOptions = options.models.filter(
    (model) => model.manufacturerId === form.manufacturerId,
  );

  const handleManufacturerChange = (value: number | null) => {
    onChange("manufacturerId", value);

    if (
      form.modelId &&
      !options.models.some(
        (model) => model.id === form.modelId && model.manufacturerId === value,
      )
    ) {
      onChange("modelId", null);
    }
  };

  return (
    <form className="equipment-create-form" onSubmit={onSubmit}>
      <div className="equipment-form-grid">
        <EquipmentIdentityFields
          {...fields}
          options={options}
          modelOptions={modelOptions}
          onManufacturerChange={handleManufacturerChange}
        />
        <EquipmentDetailsFields {...fields} options={options} />
        <EquipmentNotesFields {...fields} />
      </div>

      <div className="equipment-form-actions">
        <button
          className="equipment-submit-button"
          disabled={isSubmitting}
          type="submit"
        >
          <Save aria-hidden="true" size={18} />
          <span>{isSubmitting ? submittingLabel : submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
