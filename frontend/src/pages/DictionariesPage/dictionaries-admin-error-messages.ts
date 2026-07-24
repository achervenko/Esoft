import { DictionariesAdminApiError } from "../../shared/api/dictionaries-admin-api";
import { AdminApiError } from "../../shared/api/users-admin-api";

export function getDictionariesAdminErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "Нет соединения с сервером.";
  }

  if (error instanceof AdminApiError) {
    if (error.status === 401) {
      return "Сессия завершена. Войдите в систему повторно.";
    }

    if (error.status === 403) {
      return "Недостаточно прав для управления справочниками.";
    }

    return getUserAdminErrorByCode(error.code) ?? error.message;
  }

  if (error instanceof DictionariesAdminApiError) {
    if (error.status === 401) {
      return "Сессия завершена. Войдите в систему повторно.";
    }

    if (error.status === 403) {
      return "Недостаточно прав для управления справочниками.";
    }

    return getDictionaryErrorByCode(error.code) ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось загрузить справочники.";
}

function getUserAdminErrorByCode(code: string | undefined) {
  switch (code) {
    case "CANNOT_DISABLE_OWN_EMPLOYEE":
      return "Нельзя отключить сотрудника, связанного с текущей учётной записью.";
    default:
      return null;
  }
}

function getDictionaryErrorByCode(code: string | null) {
  switch (code) {
    case "COUNTRY_ISO_INVALID":
      return "ISO должен состоять из двух латинских букв.";
    case "COUNTRY_ISO_REQUIRED":
      return "Укажите ISO страны.";
    case "COUNTRY_NOT_FOUND":
    case "EQUIPMENT_MODEL_NOT_FOUND":
    case "MANUFACTURER_NOT_FOUND":
      return "Запись не найдена.";
    case "DICTIONARY_ITEM_ALREADY_EXISTS":
      return "Такая запись уже есть в справочнике.";
    case "DICTIONARY_ITEM_IN_USE":
      return "Запись используется в системе, удалить её нельзя.";
    case "DICTIONARY_NAME_REQUIRED":
      return "Укажите название.";
    case "DICTIONARY_NAME_TOO_LONG":
      return "Название слишком длинное.";
    case "DICTIONARY_PARENT_REQUIRED":
      return "Укажите родительский элемент.";
    case "LOCATION_NOT_FOUND":
    case "OBJECT_NOT_FOUND":
      return "Запись не найдена.";
    default:
      return null;
  }
}
