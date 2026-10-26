import { FormField } from "./FormField";
import type { ComponentPropsWithoutRef, Ref } from "react";

export type TextFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "onChange" | "value" | "children"
> & {
  fieldClassName?: string;
  hideLabel?: boolean;
  label: string;
  error?: string;
  warning?: string;
  inputRef?: Ref<HTMLInputElement>;
  selectOnFocus?: boolean;
  value: string;
  onChange: (value: string) => void;
};

export function TextField({
  error,
  warning,
  inputRef,
  label,
  fieldClassName,
  hideLabel,
  onChange,
  onFocus,
  required = false,
  selectOnFocus = false,
  value,
  ...inputProps
}: TextFieldProps) {
  return (
    <FormField
      label={label}
      className={fieldClassName}
      hideLabel={hideLabel}
      required={required}
      error={error}
      warning={warning}
    >
      <input
        {...inputProps}
        ref={inputRef}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          if (selectOnFocus) {
            event.target.select();
          }
          onFocus?.(event);
        }}
        required={required}
        value={value}
      />
    </FormField>
  );
}

export function TextareaField({
  label,
  fieldClassName,
  error,
  warning,
  onChange,
  required = false,
  textareaRef,
  value,
  ...textareaProps
}: Omit<
  ComponentPropsWithoutRef<"textarea">,
  "onChange" | "value" | "children"
> & {
  fieldClassName?: string;
  label: string;
  error?: string;
  warning?: string;
  onChange: (value: string) => void;
  required?: boolean;
  textareaRef?: Ref<HTMLTextAreaElement>;
  value: string;
}) {
  return (
    <FormField
      label={label}
      className={fieldClassName}
      required={required}
      error={error}
      warning={warning}
    >
      <textarea
        {...textareaProps}
        onChange={(event) => onChange(event.target.value)}
        ref={textareaRef}
        required={required}
        value={value}
      />
    </FormField>
  );
}
