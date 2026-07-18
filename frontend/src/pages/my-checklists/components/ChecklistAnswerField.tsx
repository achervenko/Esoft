import type { ChangeEvent } from "react";
import type { ChecklistAnswerFieldProps } from "../my-checklists.types";

export function ChecklistAnswerField({
  answerType,
  disabled,
  onChange,
  value,
}: ChecklistAnswerFieldProps) {
  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    onChange(event.target.value);
  };

  switch (answerType) {
    case "BOOLEAN":
      return (
        <select
          className="my-checklists-boolean-field"
          disabled={disabled}
          onChange={handleChange}
          value={value}
        >
          <option value="">Выберите ответ</option>
          <option value="true">Да</option>
          <option value="false">Нет</option>
        </select>
      );
    case "INTEGER":
      return (
        <input
          disabled={disabled}
          inputMode="numeric"
          onChange={handleChange}
          type="number"
          value={value}
        />
      );
    case "DECIMAL":
      return (
        <input
          disabled={disabled}
          inputMode="decimal"
          onChange={handleChange}
          type="text"
          value={value}
        />
      );
    case "TEXT":
      return <textarea disabled={disabled} onChange={handleChange} value={value} />;
    case "DATE":
      return (
        <input
          disabled={disabled}
          onChange={handleChange}
          type="date"
          value={value}
        />
      );
  }
}
