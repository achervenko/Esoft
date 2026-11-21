const presentation = {
  SUCCESS: { label: "Работает", color: "green" },
  FAILED: { label: "Ошибка обмена", color: "red" },
  PARTIAL_FAILURE: { label: "Частично обработан", color: "orange" },
  BLOCKED: { label: "Требуется проверить настройки", color: "red" },
  RUNNING: { label: "Выполняется", color: "blue" },
  INTERRUPTED: { label: "Прерван", color: "orange" },
} as const;

export function invoiceSchedulePresentation(outcome: string | null) {
  if (!outcome) return { label: "Ожидает первого обмена", color: "yellow" };
  return Object.hasOwn(presentation, outcome)
    ? presentation[outcome as keyof typeof presentation]
    : { label: outcome, color: "gray" };
}
