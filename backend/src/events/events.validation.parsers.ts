import { throwEventBadRequest } from './events.errors';

export function parseOptionalNonEmptyString(
  value: unknown,
  code: string,
  message: string,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseRequiredNonEmptyString(value, code, message);
}

export function parseRequiredNonEmptyString(
  value: unknown,
  code: string,
  message: string,
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throwEventBadRequest(code, message);
  }

  return value.trim();
}

export function parseOptionalNullableText(
  value: unknown,
  code: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throwEventBadRequest(code, 'Некорректный комментарий.');
  }

  const trimmedValue = value.trim();

  return trimmedValue || null;
}

export function parsePositiveInteger(
  value: unknown,
  code: string,
  message: string,
): number {
  const numberValue = parseIntegerValue(value);

  if (numberValue === undefined || numberValue <= 0) {
    throwEventBadRequest(code, message);
  }

  return numberValue;
}

export function parseRequiredDate(
  value: unknown,
  code: string,
  message: string,
): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throwEventBadRequest(code, message);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
    throwEventBadRequest(code, message);
  }

  return date;
}

function parseIntegerValue(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : undefined;
  }

  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
    const numberValue = Number(value);

    return Number.isSafeInteger(numberValue) ? numberValue : undefined;
  }

  return undefined;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
