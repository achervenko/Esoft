import type { Ref } from "react";

export function AdminTextField({
  autoFocus = false,
  disabled = false,
  inputRef,
  label,
  maxLength,
  onChange,
  required = false,
  selectOnFocus = false,
  value,
}: {
  autoFocus?: boolean;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  required?: boolean;
  selectOnFocus?: boolean;
  value: string;
}) {
  return (
    <label className="form-field">
      <span>
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>
      <input
        autoFocus={autoFocus}
        disabled={disabled}
        ref={inputRef}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          if (selectOnFocus) {
            event.target.select();
          }
        }}
        required={required}
        value={value}
      />
    </label>
  );
}

export function AdminTextareaField({
  autoFocus = false,
  disabled = false,
  label,
  onChange,
  required = false,
  textareaRef,
  value,
}: {
  autoFocus?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  textareaRef?: Ref<HTMLTextAreaElement>;
  value: string;
}) {
  return (
    <label className="form-field">
      <span>
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>
      <textarea
        autoFocus={autoFocus}
        className="checklist-admin-textarea"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        ref={textareaRef}
        required={required}
        value={value}
      />
    </label>
  );
}

export function AdminFormActions({
  isSaving,
  onClose,
}: {
  isSaving: boolean;
  onClose: () => void;
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
      <button className="admin-primary-button" disabled={isSaving} type="submit">
        {isSaving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}
