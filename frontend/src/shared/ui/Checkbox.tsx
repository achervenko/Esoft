import type { ReactNode } from "react";
import "./Checkbox.css";

type CheckboxProps = {
  checked: boolean;
  disabled?: boolean;
  label?: ReactNode;
  name?: string;
  onChange: (checked: boolean) => void;
  required?: boolean;
};

export function Checkbox({
  checked,
  disabled = false,
  label,
  name,
  onChange,
  required = false,
}: CheckboxProps) {
  return (
    <label className={`app-checkbox${disabled ? " disabled" : ""}`}>
      <input
        checked={checked}
        disabled={disabled}
        name={name}
        onChange={(event) => onChange(event.target.checked)}
        required={required}
        type="checkbox"
      />
      <span className="app-checkbox-control" aria-hidden="true">
        <span />
      </span>
      {label ? <span className="app-checkbox-label">{label}</span> : null}
    </label>
  );
}
