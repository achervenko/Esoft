import { ApiRequestError } from "../../shared/api/equipment-api";

export function getMaintenanceSettingsErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "Нет соединения с сервером.";
  }

  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Сессия завершена. Войдите в систему повторно.";
    }

    if (error.status === 403) {
      return "Недостаточно прав для управления настройками обслуживания.";
    }

    return getMaintenanceSettingsErrorByCode(error.code) ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось выполнить запрос.";
}

function getMaintenanceSettingsErrorByCode(code: string | undefined) {
  switch (code) {
    case "EQUIPMENT_NOT_FOUND":
      return "Оборудование не найдено.";
    case "MAINTENANCE_TYPE_CODE_ALREADY_EXISTS":
      return "Вид обслуживания с таким кодом уже существует.";
    case "MAINTENANCE_TYPE_CODE_INVALID":
      return "Код должен начинаться с латинской буквы и содержать только A-Z, 0-9 и _.";
    case "MAINTENANCE_TYPE_CODE_REQUIRED":
      return "Укажите код вида обслуживания.";
    case "MAINTENANCE_TYPE_CODE_TOO_LONG":
      return "Код вида обслуживания слишком длинный.";
    case "MAINTENANCE_TYPE_ALREADY_EXISTS":
      return "Вид обслуживания с таким названием или кодом уже существует.";
    case "MAINTENANCE_TYPE_NAME_ALREADY_EXISTS":
      return "Вид обслуживания с таким названием уже существует.";
    case "MAINTENANCE_TYPE_NAME_REQUIRED":
      return "Укажите название вида обслуживания.";
    case "MAINTENANCE_TYPE_NAME_TOO_LONG":
      return "Название вида обслуживания слишком длинное.";
    case "MAINTENANCE_TYPE_REQUIRED":
      return "Укажите вид обслуживания.";
    case "MAINTENANCE_TYPE_NOT_FOUND":
      return "Вид обслуживания не найден.";
    case "MAINTENANCE_TYPE_INACTIVE":
      return "Вид обслуживания отключён.";
    case "EXECUTION_TYPE_INVALID":
      return "Укажите корректный способ выполнения.";
    case "CHECKLIST_TEMPLATE_ID_INVALID":
      return "Некорректный шаблон чек-листа.";
    case "MAINTENANCE_SETTING_ALREADY_EXISTS":
      return "Этот вид обслуживания уже настроен для модели оборудования.";
    case "MAINTENANCE_SETTING_NOT_FOUND":
      return "Настройка обслуживания не найдена.";
    case "MAINTENANCE_SETTING_UPDATE_EMPTY":
      return "Передайте хотя бы одно поле для изменения.";
    case "PERIODICITY_FORMAT_CONFLICT":
      return "Передайте периодичность объектом.";
    case "PERIODICITY_INVALID":
      return "Укажите корректную периодичность.";
    case "PERIODICITY_VALUE_INVALID":
      return "Периодичность должна быть больше нуля и состоять из целых неотрицательных чисел.";
    case "REQUEST_BODY_REQUIRED":
      return "Передайте данные настройки.";
    default:
      return null;
  }
}
