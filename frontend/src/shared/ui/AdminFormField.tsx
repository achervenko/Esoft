import { FormField, type FormFieldProps } from "./FormField";
import "./AdminFormField.css";

export function AdminFormField({ className = "", ...props }: FormFieldProps) {
  return (
    <FormField
      {...props}
      className={`admin-control-field ${className}`.trim()}
    />
  );
}
