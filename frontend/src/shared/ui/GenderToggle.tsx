import { useId } from "react";
import { RequiredMark } from "./RequiredMark";
import "./FormField.css";

export type Gender = "MALE" | "FEMALE";

export function GenderToggle({ value, onChange, disabled = false }: {
  value: Gender | "" | null;
  onChange: (value: Gender) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="form-field gender-field" disabled={disabled} role="radiogroup" aria-labelledby={`${name}-label`}>
      <legend id={`${name}-label`} className="form-field-label">Пол<RequiredMark /></legend>
      <div className="gender-toggle">
        {([ ["MALE", "Мужской"], ["FEMALE", "Женский"] ] as const).map(([gender, label]) => (
          <label className="gender-toggle-segment" key={gender}>
            <input type="radio" name={name} value={gender} required
              checked={value === gender} onChange={() => onChange(gender)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
