import type { ChecklistAdminConfirmState } from "./checklist-admin.types";

export function getConfirmTitle(confirm: NonNullable<ChecklistAdminConfirmState>) {
  if (confirm.kind === "archive-template") {
    return "Удалить шаблон?";
  }

  if (confirm.kind === "module-status") {
    return confirm.module.isActive
      ? "Деактивировать модуль?"
      : "Активировать модуль?";
  }

  return confirm.question.isActive
    ? "Деактивировать вопрос?"
    : "Активировать вопрос?";
}

export function getConfirmDescription(
  confirm: NonNullable<ChecklistAdminConfirmState>,
) {
  if (confirm.kind === "archive-template") {
    return "Шаблон больше нельзя будет использовать для новых событий. Уже созданные события и чек-листы не изменятся.";
  }

  if (confirm.kind === "module-status") {
    return confirm.module.isActive
      ? "Модуль нельзя будет добавлять в новые шаблоны. Существующие шаблоны не изменятся."
      : "Модуль снова можно будет использовать в новых шаблонах.";
  }

  return confirm.question.isActive
    ? "Вопрос нельзя будет добавлять в новые шаблоны. Существующие шаблоны не изменятся."
    : "Вопрос снова можно будет использовать в новых шаблонах.";
}

export function getConfirmLabel(confirm: NonNullable<ChecklistAdminConfirmState>) {
  if (confirm.kind === "archive-template") {
    return "Удалить";
  }

  if (confirm.kind === "module-status") {
    return confirm.module.isActive ? "Деактивировать" : "Активировать";
  }

  return confirm.question.isActive ? "Деактивировать" : "Активировать";
}
