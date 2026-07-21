import { ApiRequestError } from "../../shared/api/api-error";
import type { SetupFieldErrors, SetupFormState } from "./setup.types";

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;

export function validateSetupForm(form: SetupFormState) {
  const errors: SetupFieldErrors = {};
  const employeeId = Number(form.employeeId);
  const email = form.email.trim();
  const normalizedEmail = email.toLowerCase();
  const username = form.username.trim();
  const password = form.password;

  if (!form.employeeId || !Number.isInteger(employeeId) || employeeId <= 0) {
    errors.employeeId = "Выберите сотрудника.";
  }

  if (!email) {
    errors.email = "Укажите email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Укажите корректный email.";
  }

  if (!username) {
    errors.username = "Укажите логин.";
  } else if (!USERNAME_PATTERN.test(username)) {
    errors.username = "Логин должен содержать 3-64 латинских символа, цифры, точку, дефис или подчёркивание.";
  }

  if (
    password.length < 8 ||
    password.length > 128 ||
    password.trim().length === 0 ||
    password === username ||
    password === normalizedEmail ||
    !/\p{L}/u.test(password) ||
    !/\d/.test(password)
  ) {
    errors.password =
      "Пароль должен содержать от 8 до 128 символов, букву и цифру и не совпадать с логином или email.";
  }

  if (form.password !== form.passwordConfirmation) {
    errors.passwordConfirmation = "Пароли не совпадают.";
  }

  return errors;
}

export function getSetupErrorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return "Не удалось завершить первоначальную настройку.";
  }

  switch (error.code) {
    case "SETUP_ALREADY_COMPLETED":
      return "Первоначальная настройка уже завершена.";
    case "SETUP_EMPLOYEE_NOT_FOUND":
      return "Сотрудник не найден.";
    case "SETUP_EMPLOYEE_INACTIVE":
      return "Нельзя создать учётную запись для отключённого сотрудника.";
    case "SETUP_EMAIL_ALREADY_EXISTS":
      return "Пользователь с таким email уже существует.";
    case "SETUP_USERNAME_ALREADY_EXISTS":
      return "Пользователь с таким логином уже существует.";
    case "SETUP_PASSWORD_TOO_WEAK":
      return "Пароль не соответствует требованиям безопасности.";
    case "SETUP_PASSWORD_CONFIRMATION_MISMATCH":
      return "Пароли не совпадают.";
    case "SETUP_RATE_LIMITED":
      return "Слишком много попыток. Попробуйте позже.";
    case "SETUP_INVALID_ORIGIN":
      return "Недопустимый источник запроса.";
    case "SETUP_INVALID_PAYLOAD":
      return error.message || "Проверьте данные формы.";
    case "SETUP_CREATION_FAILED":
      return "Не удалось завершить первоначальную настройку.";
    default:
      return "Не удалось завершить первоначальную настройку.";
  }
}

export function getSetupErrorCode(error: unknown) {
  return error instanceof ApiRequestError ? error.code ?? null : null;
}

export function hasSetupFieldErrors(errors: SetupFieldErrors) {
  return Object.keys(errors).length > 0;
}
