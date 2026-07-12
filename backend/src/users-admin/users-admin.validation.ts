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
    '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0444\u0430\u043c\u0438\u043b\u0438\u044e.',
    MAX_NAME_LENGTH,
  );
  const firstName = parseRequiredText(
    payload.firstName,
    'FIRST_NAME_REQUIRED',
    '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0438\u043c\u044f.',
    MAX_NAME_LENGTH,
  );
  const position = parseRequiredText(
    payload.position,
    'POSITION_REQUIRED',
    '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0434\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c.',
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
    '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 email.',
    MAX_EMAIL_LENGTH,
  ).toLowerCase();
  const username = parseRequiredText(
    payload.username,
    'USERNAME_REQUIRED',
    '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043b\u043e\u0433\u0438\u043d.',
    MAX_NAME_LENGTH,
  );
  const role = parseRole(payload.role);
  const employeeId = parseEmployeeId(payload.employeeId);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throwBadRequest(
      'INVALID_EMAIL',
      '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 email.',
    );
  }

  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
    throwBadRequest(
      'INVALID_USERNAME',
      '\u041b\u043e\u0433\u0438\u043d \u043c\u043e\u0436\u0435\u0442 \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043b\u0430\u0442\u0438\u043d\u0438\u0446\u0443, \u0446\u0438\u0444\u0440\u044b, \u0442\u043e\u0447\u043a\u0443, \u0434\u0435\u0444\u0438\u0441 \u0438 \u043d\u0438\u0436\u043d\u0435\u0435 \u043f\u043e\u0434\u0447\u0451\u0440\u043a\u0438\u0432\u0430\u043d\u0438\u0435.',
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
  const password = parseRequiredText(
    value,
    'PASSWORD_REQUIRED',
    '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c.',
    MAX_PASSWORD_LENGTH,
  );

  if (password.length < MIN_PASSWORD_LENGTH) {
    throwBadRequest(
      'PASSWORD_TOO_SHORT',
      '\u041f\u0430\u0440\u043e\u043b\u044c \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u043d\u0435 \u043a\u043e\u0440\u043e\u0447\u0435 8 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432.',
    );
  }

  return password;
}

export function parseBoolean(value: unknown) {
  if (typeof value !== 'boolean') {
    throwBadRequest(
      'INVALID_STATUS',
      '\u041d\u0435\u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0443\u0447\u0451\u0442\u043d\u043e\u0439 \u0437\u0430\u043f\u0438\u0441\u0438.',
    );
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
    throwBadRequest(
      'VALUE_TOO_LONG',
      '\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043b\u0438\u043d\u043d\u043e\u0435.',
    );
  }

  return cleanValue;
}

function parseOptionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throwBadRequest(
      'INVALID_VALUE',
      '\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.',
    );
  }

  const cleanValue = value.trim();

  if (!cleanValue) {
    return null;
  }

  if (cleanValue.length > maxLength) {
    throwBadRequest(
      'VALUE_TOO_LONG',
      '\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0434\u043b\u0438\u043d\u043d\u043e\u0435.',
    );
  }

  return cleanValue;
}

function parseRole(value: unknown): UserRole {
  if (
    typeof value !== 'string' ||
    !(userRoles as readonly string[]).includes(value)
  ) {
    throwBadRequest(
      'INVALID_ROLE',
      '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043e\u043f\u0443\u0441\u0442\u0438\u043c\u0443\u044e \u0440\u043e\u043b\u044c.',
    );
  }

  return value as UserRole;
}

function parseEmployeeId(value: unknown) {
  const employeeId = Number(value);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throwBadRequest(
      'EMPLOYEE_REQUIRED',
      '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430.',
    );
  }

  return employeeId;
}
