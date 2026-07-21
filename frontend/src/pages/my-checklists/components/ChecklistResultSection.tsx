import {
  checklistResultLabels,
  checklistResultOptions,
} from "../../../shared/api/checklists";
import type { ChecklistResultSectionProps } from "../my-checklists.types";

export function ChecklistResultSection({
  canEdit,
  error,
  onChange,
  result,
}: ChecklistResultSectionProps) {
  if (!canEdit) {
    return (
      <section className="my-checklists-result-section">
        <h3>Результат</h3>
        <p className="my-checklists-result-readonly">
          {result ? checklistResultLabels[result] : "Не указано"}
        </p>
      </section>
    );
  }

  return (
    <fieldset className="my-checklists-result-section">
      <legend>Результат:</legend>
      <div className="my-checklists-result-options">
        {checklistResultOptions.map((option) => (
          <label key={option.value}>
            <input
              checked={result === option.value}
              name="checklist-result"
              onChange={() => onChange(option.value)}
              required
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error ? <small className="field-error">{error}</small> : null}
    </fieldset>
  );
}
