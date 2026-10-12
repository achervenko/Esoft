import { PpePeriodUnit } from '@prisma/client';
import { badPpeRequest, parsePpeObject } from './ppe.validation';

export function parseNormId(value: unknown, code = 'INVALID_NORM_ID'): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > 2_147_483_647
  ) {
    badPpeRequest(
      code,
      'Идентификатор должен быть положительным целым числом.',
    );
  }
  return value;
}

export function parseNormDate(value: unknown): Date {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000-')
  ) {
    badPpeRequest(
      'INVALID_NORM_DATE',
      'Укажите календарную дату в формате YYYY-MM-DD.',
    );
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    badPpeRequest('INVALID_NORM_DATE', 'Укажите корректную календарную дату.');
  }
  return date;
}

function parseNormItem(payload: unknown) {
  const values = parsePpeObject(payload, [
    'ppeItemId',
    'quantity',
    'periodCount',
    'periodUnit',
  ]);
  const ppeItemId = parseNormId(values.ppeItemId, 'INVALID_PPE_ITEM_ID');
  const quantity = values.quantity;
  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 999_999_999.999 ||
    Number(quantity.toFixed(3)) !== quantity
  ) {
    badPpeRequest(
      'INVALID_NORM_QUANTITY',
      'Количество должно быть положительным числом NUMERIC(12,3) с максимум тремя знаками после запятой.',
    );
  }
  const periodCount = parseNormId(values.periodCount, 'INVALID_NORM_PERIOD');
  const periodUnit = values.periodUnit;
  if (
    periodUnit !== PpePeriodUnit.DAY &&
    periodUnit !== PpePeriodUnit.MONTH &&
    periodUnit !== PpePeriodUnit.YEAR
  ) {
    badPpeRequest(
      'INVALID_NORM_PERIOD',
      'Единица периода должна быть DAY, MONTH или YEAR.',
    );
  }
  return {
    ppeItemId,
    quantity,
    periodCount,
    periodUnit,
  };
}

function parseNormContent(values: Record<string, unknown>) {
  const effectiveFrom = parseNormDate(values.effectiveFrom);
  const effectiveTo =
    values.effectiveTo === null || values.effectiveTo === undefined
      ? null
      : parseNormDate(values.effectiveTo);
  if (effectiveTo && effectiveTo < effectiveFrom) {
    badPpeRequest(
      'INVALID_NORM_DATE',
      'Дата окончания не может быть раньше даты начала.',
    );
  }
  if (!Array.isArray(values.items) || values.items.length === 0) {
    badPpeRequest(
      'PPE_NORM_ITEMS_REQUIRED',
      'Норма должна содержать хотя бы одну позицию СИЗ.',
    );
  }
  const items = values.items.map((item: unknown) => parseNormItem(item));
  if (new Set(items.map((item) => item.ppeItemId)).size !== items.length) {
    badPpeRequest(
      'PPE_NORM_ITEM_DUPLICATE',
      'Позиция СИЗ не может повторяться внутри нормы.',
    );
  }
  if (
    values.transitionMode !== undefined &&
    (typeof values.transitionMode !== 'string' ||
      !['SOFT', 'HARD'].includes(values.transitionMode))
  )
    badPpeRequest(
      'INVALID_NORM_TRANSITION_MODE',
      'Выберите мягкий или жёсткий переход.',
    );
  return {
    effectiveFrom,
    effectiveTo,
    items,
    ...(values.transitionMode !== undefined
      ? { transitionMode: values.transitionMode }
      : {}),
  };
}

export function parseCreateNorm(payload: unknown) {
  const values = parsePpeObject(payload, [
    'positionId',
    'effectiveFrom',
    'effectiveTo',
    'items',
    'transitionMode',
  ]);
  return {
    positionId: parseNormId(values.positionId, 'INVALID_POSITION_ID'),
    ...parseNormContent(values),
  };
}

export function parseNormRevision(payload: unknown) {
  return parseNormContent(
    parsePpeObject(payload, [
      'effectiveFrom',
      'effectiveTo',
      'items',
      'transitionMode',
    ]),
  );
}

function parseQueryId(value: unknown) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    badPpeRequest(
      'INVALID_POSITION_ID',
      'Укажите положительный идентификатор должности.',
    );
  }
  return parseNormId(Number(value), 'INVALID_POSITION_ID');
}

export function parseNormListQuery(payload: unknown) {
  const values = parsePpeObject(payload, ['positionId']);
  return values.positionId === undefined
    ? undefined
    : parseQueryId(values.positionId);
}

export function parseEffectiveNormQuery(payload: unknown) {
  const values = parsePpeObject(payload, ['date']);
  return values.date === undefined ? undefined : parseNormDate(values.date);
}
