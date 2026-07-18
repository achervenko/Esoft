import { ChecklistAnswerType, Prisma } from '@prisma/client';
import { throwChecklistBadRequest } from '../checklist-common/checklists.errors';
import { parseDateString } from '../checklist-common/checklists.validation';
import type { ChecklistAnswerValue } from './checklist-work.types';

export function parseAnswerValue(
  answerType: ChecklistAnswerType,
  value: unknown,
): ChecklistAnswerValue {
  if (value === null) {
    return { kind: 'clear' };
  }

  switch (answerType) {
    case ChecklistAnswerType.BOOLEAN:
      if (typeof value === 'boolean') {
        return { kind: ChecklistAnswerType.BOOLEAN, value };
      }
      break;
    case ChecklistAnswerType.INTEGER:
      return {
        kind: ChecklistAnswerType.INTEGER,
        value: parseIntegerAnswer(value),
      };
    case ChecklistAnswerType.DECIMAL:
      return {
        kind: ChecklistAnswerType.DECIMAL,
        value: parseDecimalAnswer(value),
      };
    case ChecklistAnswerType.TEXT:
      if (typeof value === 'string') {
        const text = value.trim();

        return { kind: ChecklistAnswerType.TEXT, value: text || null };
      }
      break;
    case ChecklistAnswerType.DATE:
      return { kind: ChecklistAnswerType.DATE, value: parseDateAnswer(value) };
  }

  throwChecklistBadRequest(
    'CHECKLIST_ANSWER_TYPE_INVALID',
    'Значение не соответствует типу ответа.',
  );
}

export function parseIntegerAnswer(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^-?(0|[1-9]\d*)$/.test(value)) {
    const parsedValue = Number(value);

    if (Number.isSafeInteger(parsedValue)) {
      return parsedValue;
    }
  }

  throwChecklistBadRequest(
    'CHECKLIST_ANSWER_VALUE_INVALID',
    'Некорректное целочисленное значение.',
  );
}

export function parseDecimalAnswer(value: unknown) {
  if (typeof value !== 'string') {
    throwChecklistBadRequest(
      'CHECKLIST_ANSWER_VALUE_INVALID',
      'Decimal-ответ должен быть строкой.',
    );
  }

  const trimmedValue = value.trim();

  if (!/^-?\d+(\.\d{1,6})?$/.test(trimmedValue)) {
    throwChecklistBadRequest(
      'CHECKLIST_ANSWER_VALUE_INVALID',
      'Некорректное decimal-значение.',
    );
  }

  const normalizedValue = normalizeDecimal(trimmedValue);
  const [integerPart] = normalizedValue.replace('-', '').split('.');

  if (integerPart.length > 12) {
    throwChecklistBadRequest(
      'CHECKLIST_ANSWER_VALUE_INVALID',
      'Decimal-значение не помещается в NUMERIC(18, 6).',
    );
  }

  return normalizedValue;
}

export function parseDateAnswer(value: unknown) {
  return parseDateString(value);
}

export function normalizeStoredDecimal(value: Prisma.Decimal | string | null) {
  return value === null ? null : normalizeDecimal(String(value));
}

export function normalizeDecimal(value: string) {
  const sign = value.startsWith('-') ? '-' : '';
  const unsignedValue = sign ? value.slice(1) : value;
  const [integerPart, fractionalPart = ''] = unsignedValue.split('.');
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '');
  const normalizedFractional = fractionalPart.replace(/0+$/, '');
  const normalized = `${normalizedInteger || '0'}${
    normalizedFractional ? `.${normalizedFractional}` : ''
  }`;

  return normalized === '0' ? '0' : `${sign}${normalized}`;
}

export function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}
