import { BadRequestException } from '@nestjs/common';

export const userRoles = [
  'admin',
  'chief_engineer',
  'engineer',
  'operator',
  'auditor',
] as const;

export type UserRole = (typeof userRoles)[number];

type EmployeePayload = {
  firstName?: unknown;
  lastName?: unknown;
  middleName?: unknown;
  position?: unknown;
};

type UserPayload = {
  email?: unknown;
  employeeId?: unknown;
  password?: unknown;
  role?: unknown;
  username?: unknown;
};

const MAX_NAME_LENGTH = 64;
const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

export function parseEmployeePayload(payload: EmployeePayload) {
  const lastName = parseRequiredText(
    payload.lastName,
    'LAST_NAME_REQUIRED',
    'Укажите фамилию.',
    MAX_NAME_LENGTH,
  );
  const firstName = parseRequiredText(
    payload.firstName,
    'FIRST_NAME_REQUIRED',
    'Укажите имя.',
    MAX_NAME_LENGTH,
  );
  const position = parseRequiredText(
    payload.position,
    'POSITION_REQUIRED',
    'Укажите должность.',
    MAX_NAME_LENGTH,
  );
  const middleName = parseOptionalText(payload.middleName, MAX_NAME_LENGTH);

  return {
    firstName,
    lastName,
    middleName,
    position,
  };
}

export function parseCreateUserPayload(payload: UserPayload) {
  return {
    ...parseUpdateUserPayload(payload),
    password: parsePassword(payload.password),
  };
}

export function parseUpdateUserPayload(payload: UserPayload) {
  const email = parseRequiredText(
    payload.email,
    'EMAIL_REQUIRED',
    'Укажите email.',
    MAX_EMAIL_LENGTH,
  ).toLowerCase();
  const username = parseRequiredText(
    payload.username,
    'USERNAME_REQUIRED',
    'Укажите логин.',
    MAX_NAME_LENGTH,
  ).toLowerCase();
  const role = parseRole(payload.role);
  const employeeId = parseEmployeeId(payload.employeeId);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throwBadRequest('INVALID_EMAIL', 'Укажите корректный email.');
  }

  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    throwBadRequest(
      'INVALID_USERNAME',
      'Логин может содержать латиницу, цифры, точку, дефис и нижнее подчёркивание.',
    );
  }

  return {
    email,
    employeeId,
    role,
    username,
  };
}

export function parsePassword(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    throwBadRequest('PASSWORD_REQUIRED', 'Укажите пароль.');
  }

  if (value.length > MAX_PASSWORD_LENGTH) {
    throwBadRequest('VALUE_TOO_LONG', 'Значение слишком длинное.');
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    throwBadRequest(
      'PASSWORD_TOO_SHORT',
      'Пароль должен быть не короче 8 символов.',
    );
  }

  return value;
}

export function parseBoolean(value: unknown) {
  if (typeof value !== 'boolean') {
    throwBadRequest('INVALID_STATUS', 'Некорректное значение статуса.');
  }

  return value;
}

export function throwBadRequest(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

function parseRequiredText(
  value: unknown,
  code: string,
  message: string,
  maxLength: number,
) {
  if (typeof value !== 'string' || !value.trim()) {
    throwBadRequest(code, message);
  }

  const cleanValue = value.trim();

  if (cleanValue.length > maxLength) {
    throwBadRequest('VALUE_TOO_LONG', 'Значение слишком длинное.');
  }

  return cleanValue;
}

function parseOptionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throwBadRequest('INVALID_VALUE', 'Проверьте значение.');
  }

  const cleanValue = value.trim();

  if (!cleanValue) {
    return null;
  }

  if (cleanValue.length > maxLength) {
    throwBadRequest('VALUE_TOO_LONG', 'Значение слишком длинное.');
  }

  return cleanValue;
}

function parseRole(value: unknown): UserRole {
  if (
    typeof value !== 'string' ||
    !(userRoles as readonly string[]).includes(value)
  ) {
    throwBadRequest('INVALID_ROLE', 'Выберите допустимую роль.');
  }

  return value as UserRole;
}

function parseEmployeeId(value: unknown) {
  const employeeId = Number(value);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throwBadRequest('EMPLOYEE_REQUIRED', 'Выберите сотрудника.');
  }

  return employeeId;
}
