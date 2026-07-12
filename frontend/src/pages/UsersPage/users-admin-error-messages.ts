import { AdminApiError } from "../../shared/api/users-admin-api";

const messagesByCode: Record<string, string> = {
  CANNOT_DISABLE_SELF: "Нельзя отключить свою учётную запись.",
  EMAIL_ALREADY_EXISTS: "Пользователь с таким email уже существует.",
  EMAIL_REQUIRED: "Укажите email.",
  EMPLOYEE_IN_USE:
    "Сотрудник используется в системе. Удаление недоступно.",
  EMPLOYEE_NOT_FOUND: "Сотрудник не найден.",
  EMPLOYEE_REQUIRED: "Выберите сотрудника.",
  FIRST_NAME_REQUIRED: "Укажите имя.",
  FORBIDDEN: "Недостаточно прав для управления пользователями.",
  INVALID_EMAIL: "Укажите корректный email.",
  INVALID_ROLE: "Выберите допустимую роль.",
  INVALID_STATUS: "Некорректный статус учётной записи.",
  INVALID_USERNAME:
    "Логин может содержать латиницу, цифры, точку, дефис и нижнее подчёркивание.",
  LAST_NAME_REQUIRED: "Укажите фамилию.",
  PASSWORD_REQUIRED: "Укажите пароль.",
  PASSWORD_TOO_SHORT: "Пароль должен быть не короче 8 символов.",
  POSITION_REQUIRED: "Укажите должность.",
  UNIQUE_CONSTRAINT: "Запись с такими данными уже существует.",
  USER_NOT_FOUND: "Пользователь не найден.",
  USERNAME_ALREADY_EXISTS: "Логин уже занят.",
  USERNAME_REQUIRED: "Укажите логин.",
  VALUE_TOO_LONG: "Значение слишком длинное.",
};

export function getUsersAdminErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "Нет соединения с сервером.";
  }

  if (error instanceof AdminApiError) {
    if (error.status === 401) {
      return "Сессия завершена. Войдите в систему повторно.";
    }

    if (error.status === 403) {
      return messagesByCode.FORBIDDEN;
    }

    if (error.status >= 500 && !error.code) {
      return "Сервер временно недоступен.";
    }

    return error.code ? messagesByCode[error.code] ?? error.message : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось выполнить действие.";
}
