import type { ChangeEvent } from "react";
import { formatRuDateInput } from "../my-checklists.answers";
import type { ChecklistAnswerFieldProps } from "../my-checklists.types";

export function ChecklistAnswerField({
  answerType,
  disabled,
  hasError = false,
  onChange,
  value,
}: ChecklistAnswerFieldProps) {
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    onChange(event.target.value);
  };

  const handleIntegerChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleDecimalChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value.replace(",", "."));
  };

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(formatRuDateInput(event.target.value));
  };

  const fieldClassName = `my-checklists-answer-input${
    hasError ? " has-error" : ""
  }`;

  switch (answerType) {
    case "BOOLEAN":
      return (
        <div
          aria-label="Ответ"
          className={`my-checklists-boolean-group${
            hasError ? " has-error" : ""
          }`}
          role="group"
        >
          <button
            className={`my-checklists-boolean-option${
              value === "true" ? " is-selected" : ""
            }`}
            disabled={disabled}
            onClick={() => onChange("true")}
            type="button"
          >
            Да
          </button>
          <button
            className={`my-checklists-boolean-option${
              value === "false" ? " is-selected" : ""
            }`}
            disabled={disabled}
            onClick={() => onChange("false")}
            type="button"
          >
            Нет
          </button>
        </div>
      );
    case "INTEGER":
      return (
        <input
          className={fieldClassName}
          disabled={disabled}
          inputMode="numeric"
          onChange={handleIntegerChange}
          placeholder="Введите число"
          type="text"
          value={value}
        />
      );
    case "DECIMAL":
      return (
        <input
          className={fieldClassName}
          disabled={disabled}
          inputMode="decimal"
          onChange={handleDecimalChange}
          placeholder="Введите число"
          type="text"
          value={value}
        />
      );
    case "TEXT":
      return (
        <textarea
          className={fieldClassName}
          disabled={disabled}
          onChange={handleChange}
          placeholder="Введите ответ"
          value={value}
        />
      );
    case "DATE":
      return (
        <input
          className={fieldClassName}
          disabled={disabled}
          inputMode="numeric"
          onChange={handleDateChange}
          placeholder="ДД.ММ.ГГГГ"
          type="text"
          value={value}
        />
      );
    default:
      return null;
  }
}
