import type { ComponentProps } from "react";
import { TextField, TextareaField } from "./TextField";
import "./AdminFormField.css";

export function AdminTextField({
  fieldClassName = "",
  ...props
}: ComponentProps<typeof TextField>) {
  return (
    <TextField
      {...props}
      fieldClassName={`admin-control-field ${fieldClassName}`.trim()}
    />
  );
}

export function AdminTextareaField({
  fieldClassName = "",
  className = "",
  ...props
}: ComponentProps<typeof TextareaField>) {
  return (
    <TextareaField
      {...props}
      fieldClassName={`admin-control-field ${fieldClassName}`.trim()}
      className={`admin-control-textarea ${className}`.trim()}
    />
  );
}

export function AdminFormActions({
  isSaving,
  onClose,
  submitDisabled = false,
}: {
  isSaving: boolean;
  onClose: () => void;
  submitDisabled?: boolean;
}) {
  return (
    <div className="admin-form-actions">
      <button
        className="admin-secondary-button"
        disabled={isSaving}
        onClick={onClose}
        type="button"
      >
        Отмена
      </button>
      <button
        className="admin-primary-button"
        disabled={isSaving || submitDisabled}
        type="submit"
      >
        {isSaving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}
