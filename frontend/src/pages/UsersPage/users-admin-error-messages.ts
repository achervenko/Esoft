import { AdminApiError } from "../../shared/api/users-admin-api";

const messagesByCode: Record<string, string> = {
  CANNOT_CHANGE_OWN_ROLE: "Нельзя изменить собственную роль.",
  CANNOT_DISABLE_SELF: "Нельзя отключить свою учётную запись.",
  EMAIL_ALREADY_EXISTS: "Пользователь с таким email уже существует.",
  EMAIL_REQUIRED: "Укажите email.",
  EMPLOYEE_INACTIVE:
    "Нельзя привязать отключённого сотрудника к учётной записи.",
  EMPLOYEE_NOT_FOUND: "Сотрудник не найден.",
  EMPLOYEE_REQUIRED: "Выберите сотрудника.",
  FIRST_NAME_REQUIRED: "Укажите имя.",
  FORBIDDEN: "Недостаточно прав для управления пользователями.",
  EMPTY_FILE: "Файл пустой.",
  FILE_REQUIRED: "Выберите фото для загрузки.",
  FILE_TOO_LARGE: "Размер фото не должен превышать 10 МБ.",
  IMAGE_PIXEL_LIMIT_EXCEEDED: "Разрешение фото не должно превышать 25 МП.",
  IMAGE_TOO_SMALL: "Короткая сторона фото должна быть не меньше 512 px.",
  INVALID_IMAGE: "Не удалось прочитать изображение. Выберите другой файл.",
  INVALID_EMAIL: "Укажите корректный email.",
  INVALID_ROLE: "Выберите допустимую роль.",
  INVALID_STATUS: "Некорректный статус учётной записи.",
  INVALID_USERNAME:
    "Логин может содержать латиницу, цифры, точку, дефис и нижнее подчёркивание.",
  LAST_ACTIVE_ADMIN_ROLE_REQUIRED:
    "Нельзя снять роль администратора с последней активной учётной записи администратора.",
  LAST_ACTIVE_ADMIN_STATUS_REQUIRED:
    "Нельзя отключить последнюю активную учётную запись администратора.",
  LAST_NAME_REQUIRED: "Укажите фамилию.",
  PASSWORD_REQUIRED: "Укажите пароль.",
  PASSWORD_TOO_SHORT: "Пароль должен быть не короче 8 символов.",
  POSITION_REQUIRED: "Укажите должность.",
  STORAGE_UNAVAILABLE: "Хранилище файлов временно недоступно.",
  UNIQUE_CONSTRAINT: "Запись с такими данными уже существует.",
  USER_NOT_FOUND: "Пользователь не найден.",
  USERNAME_ALREADY_EXISTS: "Логин уже занят.",
  USERNAME_REQUIRED: "Укажите логин.",
  UNSUPPORTED_FILE_FORMAT: "Для фото доступны только JPG, PNG и WebP.",
  USER_PHOTO_UPLOAD_FAILED:
    "Не удалось сохранить фото пользователя. Изменения отменены.",
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

    return error.code
      ? (messagesByCode[error.code] ?? error.message)
      : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось выполнить действие.";
}
