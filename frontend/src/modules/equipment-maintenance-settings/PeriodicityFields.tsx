import type { MaintenancePeriodicity } from "../../shared/api/maintenance/maintenance.types";
import { Checkbox } from "../../shared/ui/Checkbox";
import type { PeriodicityForm } from "./maintenance-setting-form-utils";

type PeriodicityFieldsProps = {
  error?: string;
  hasPeriodicity: boolean;
  onHasPeriodicityChange: (checked: boolean) => void;
  onPresetApply: (preset: MaintenancePeriodicity) => void;
  onValueChange: (key: keyof PeriodicityForm, value: string) => void;
  value: PeriodicityForm;
};

const periodicityPresets: Array<{
  label: string;
  value: MaintenancePeriodicity;
}> = [
  { label: "Раз в месяц", value: { years: 0, months: 1, weeks: 0, days: 0 } },
  { label: "Раз в квартал", value: { years: 0, months: 3, weeks: 0, days: 0 } },
  { label: "Раз в полгода", value: { years: 0, months: 6, weeks: 0, days: 0 } },
  { label: "Раз в год", value: { years: 1, months: 0, weeks: 0, days: 0 } },
];

export function PeriodicityFields({
  error,
  hasPeriodicity,
  onHasPeriodicityChange,
  onPresetApply,
  onValueChange,
  value,
}: PeriodicityFieldsProps) {
  return (
    <>
      <Checkbox
        checked={hasPeriodicity}
        label="Задать периодичность"
        onChange={onHasPeriodicityChange}
      />

      {hasPeriodicity ? (
        <>
          <fieldset
            className={`maintenance-periodicity-fieldset${error ? " has-error" : ""}`}
          >
            <legend>Периодичность</legend>
            <PeriodicityInput
              label="Годы"
              name="years"
              onValueChange={onValueChange}
              value={value.years}
            />
            <PeriodicityInput
              label="Месяцы"
              name="months"
              onValueChange={onValueChange}
              value={value.months}
            />
            <PeriodicityInput
              label="Недели"
              name="weeks"
              onValueChange={onValueChange}
              value={value.weeks}
            />
            <PeriodicityInput
              label="Дни"
              name="days"
              onValueChange={onValueChange}
              value={value.days}
            />
            {error ? (
              <small className="field-error maintenance-periodicity-error">
                {error}
              </small>
            ) : null}
          </fieldset>

          <div className="maintenance-periodicity-presets">
            {periodicityPresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => onPresetApply(preset.value)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

type PeriodicityInputProps = {
  label: string;
  name: keyof PeriodicityForm;
  onValueChange: (key: keyof PeriodicityForm, value: string) => void;
  value: string;
};

function PeriodicityInput({
  label,
  name,
  onValueChange,
  value,
}: PeriodicityInputProps) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        onChange={(event) =>
          onValueChange(name, event.target.value.replace(/\D/g, "").slice(0, 5))
        }
        value={value}
      />
    </label>
  );
}
