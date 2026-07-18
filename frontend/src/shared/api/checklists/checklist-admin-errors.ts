import { getApiErrorMessage } from "../api-error";

const checklistAdminErrorMessages: Record<string, string> = {
  CHECKLIST_MODULE_ALREADY_ACTIVE: "Модуль уже активен.",
  CHECKLIST_MODULE_ALREADY_INACTIVE: "Модуль уже отключён.",
  CHECKLIST_MODULE_INACTIVE: "Модуль чек-листа отключён.",
  CHECKLIST_MODULE_NAME_REQUIRED: "Укажите название модуля.",
  CHECKLIST_MODULE_NAME_TOO_LONG: "Название модуля слишком длинное.",
  CHECKLIST_MODULE_NOT_FOUND: "Модуль чек-листа не найден.",
  CHECKLIST_QUESTION_ALREADY_ACTIVE: "Вопрос уже активен.",
  CHECKLIST_QUESTION_ALREADY_INACTIVE: "Вопрос уже отключён.",
  CHECKLIST_QUESTION_INACTIVE: "Вопрос чек-листа отключён.",
  CHECKLIST_QUESTION_MODULE_MISMATCH: "Вопрос относится к другому модулю.",
  CHECKLIST_QUESTION_NOT_FOUND: "Вопрос чек-листа не найден.",
  CHECKLIST_QUESTION_TEXT_REQUIRED: "Укажите текст вопроса.",
  CHECKLIST_QUESTION_TEXT_TOO_LONG: "Текст вопроса слишком длинный.",
  CHECKLIST_TEMPLATE_EMPTY: "Заполните шаблон перед сохранением.",
  CHECKLIST_TEMPLATE_MODULE_EMPTY: "В каждом модуле должен быть хотя бы один вопрос.",
  CHECKLIST_TEMPLATE_NAME_REQUIRED: "Укажите название шаблона.",
  CHECKLIST_TEMPLATE_NAME_TOO_LONG: "Название шаблона слишком длинное.",
  CHECKLIST_TEMPLATE_NOT_FOUND: "Шаблон чек-листа не найден.",
  CHECKLIST_TEMPLATE_ORDER_INVALID: "Порядок шаблона нарушен.",
  CHECKLIST_TEMPLATE_VERSION_CONFLICT: "Шаблон был изменён другим пользователем. Перезагрузите страницу.",
};

export function getChecklistAdminErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error);

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    checklistAdminErrorMessages[error.code]
  ) {
    return checklistAdminErrorMessages[error.code];
  }

  return message;
}
