import {
  type CreateInitialAdminDto,
  type CreateInitialAdminInput,
} from './setup.types';
import {
  throwSetupInvalidPayload,
  throwSetupPasswordConfirmationMismatch,
  throwSetupPasswordTooWeak,
} from './setup.errors';

const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 128;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;

export function parseCreateInitialAdminDto(
  dto: CreateInitialAdminDto | undefined,
): CreateInitialAdminInput {
  const payload = dto ?? {};
  const employeeId = payload.employeeId;

  if (
    typeof employeeId !== 'number' ||
    !Number.isInteger(employeeId) ||
    employeeId <= 0
  ) {
    throwSetupInvalidPayload('Выберите сотрудника.');
  }

  const email = parseEmail(payload.email);
  const username = parseUsername(payload.username);
  const password = parsePassword(payload.password, email, username);

  if (payload.passwordConfirmation !== password) {
    throwSetupPasswordConfirmationMismatch();
  }

  return {
    email,
    employeeId,
    password,
    username,
  };
}

function parseEmail(value: unknown) {
  if (typeof value !== 'string') {
    throwSetupInvalidPayload('Укажите email.');
  }

  const rawEmail = value;
  const email = rawEmail.trim().toLowerCase();

  if (!email || email.length > MAX_EMAIL_LENGTH) {
    throwSetupInvalidPayload('Укажите корректный email.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throwSetupInvalidPayload('Укажите корректный email.');
  }

  return email;
}

function parseUsername(value: unknown) {
  if (typeof value !== 'string') {
    throwSetupInvalidPayload('Укажите логин.');
  }

  const rawUsername = value;
  const username = rawUsername.trim();

  if (!USERNAME_PATTERN.test(username)) {
    throwSetupInvalidPayload(
      'Логин должен содержать 3-64 латинских символа, цифры, точку, дефис или подчёркивание.',
    );
  }

  return username;
}

function parsePassword(value: unknown, email: string, username: string) {
  if (typeof value !== 'string') {
    throwSetupPasswordTooWeak();
  }

  if (
    value.length < 8 ||
    value.length > MAX_PASSWORD_LENGTH ||
    !value.trim() ||
    value === username ||
    value === email ||
    !/\p{L}/u.test(value) ||
    !/\d/.test(value)
  ) {
    throwSetupPasswordTooWeak();
  }

  return value;
}
