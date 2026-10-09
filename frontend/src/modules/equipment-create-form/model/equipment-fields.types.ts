import type {
  EquipmentCreateFieldErrors,
  EquipmentCreateFormState,
} from "./equipment-create-form.types";

export type EquipmentFieldsProps = {
  fieldErrors: EquipmentCreateFieldErrors;
  form: EquipmentCreateFormState;
  onChange: <Key extends keyof EquipmentCreateFormState>(
    key: Key,
    value: EquipmentCreateFormState[Key],
  ) => void;
  onFieldFocus: (key: keyof EquipmentCreateFormState) => void;
};
