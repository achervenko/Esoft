import { PpeIssueStatus, PpeIssueType } from '@prisma/client';
import { getBusinessTodayDate } from '../application/business-date';
import { canBackdatePpeIssue } from '../auth/role-permissions';
import { parseNormDate, parseNormId } from './ppe-norms.validation';
import { badPpeRequest, parsePpeObject } from './ppe.validation';

export type IssueActor = { userId: string; role: unknown };

export function parseIssueDay(
  value: unknown,
  role: unknown,
  provided: boolean,
) {
  if (provided && !canBackdatePpeIssue(role)) {
    badPpeRequest(
      'PPE_ISSUE_BACKDATE_FORBIDDEN',
      'Только администратор может указывать дату выдачи.',
    );
  }
  const today = getBusinessTodayDate();
  const date = provided ? parseNormDate(value) : today;
  if (date > today)
    badPpeRequest('PPE_ISSUE_FUTURE_DATE', 'Будущая дата выдачи запрещена.');
  return date;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string')
    badPpeRequest(
      'INVALID_ISSUE_COMMENT',
      'Комментарий должен быть строкой или null.',
    );
  const text = value.trim();
  if (text.length > maxLength)
    badPpeRequest(
      'VALUE_TOO_LONG',
      `Максимальная длина — ${maxLength} символов.`,
    );
  return text || null;
}

function parseIssueItem(payload: unknown, regular: boolean) {
  const values = parsePpeObject(
    payload,
    regular
      ? ['normItemId', 'ppeItemId', 'sizeId', 'comment']
      : ['ppeItemId', 'quantity', 'sizeId', 'comment'],
  );
  const base = {
    ppeItemId: parseNormId(values.ppeItemId, 'INVALID_PPE_ITEM_ID'),
    sizeId:
      values.sizeId === undefined || values.sizeId === null
        ? null
        : parseNormId(values.sizeId, 'INVALID_PPE_SIZE_ID'),
    comment: optionalText(values.comment, 2000),
  };
  if (regular)
    return {
      ...base,
      normItemId: parseNormId(values.normItemId, 'INVALID_NORM_ITEM_ID'),
      quantity: null,
    };
  const quantity = values.quantity;
  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 999_999_999.999 ||
    Number(quantity.toFixed(3)) !== quantity
  ) {
    badPpeRequest(
      'INVALID_ISSUE_QUANTITY',
      'Количество должно быть положительным числом NUMERIC(12,3).',
    );
  }
  return { ...base, normItemId: null, quantity };
}

export function parseIssueBatch(
  payload: unknown,
  regular: boolean,
  role: unknown,
) {
  const values = parsePpeObject(payload, ['employeeId', 'issuedAt', 'items']);
  const issuedAt = parseIssueDay(
    values.issuedAt,
    role,
    Object.hasOwn(values, 'issuedAt'),
  );
  if (
    !Array.isArray(values.items) ||
    !values.items.length ||
    values.items.length > 100
  ) {
    badPpeRequest(
      'PPE_ISSUE_ITEMS_REQUIRED',
      'Передайте от 1 до 100 позиций выдачи.',
    );
  }
  return {
    employeeId: parseNormId(values.employeeId, 'INVALID_EMPLOYEE_ID'),
    issuedAt,
    items: values.items.map((item: unknown) => parseIssueItem(item, regular)),
  };
}

export function parseIssueCancellation(payload: unknown) {
  const values = parsePpeObject(payload, ['reason']);
  if (typeof values.reason !== 'string' || !values.reason.trim())
    badPpeRequest(
      'PPE_ISSUE_CANCELLATION_REASON_REQUIRED',
      'Укажите причину отмены выдачи.',
    );
  const reason = values.reason.trim();
  if (reason.length > 1000)
    badPpeRequest(
      'VALUE_TOO_LONG',
      'Причина отмены не должна превышать 1000 символов.',
    );
  return reason;
}

function queryNumber(value: unknown, code: string) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))
    badPpeRequest(
      code,
      'Идентификатор должен быть положительным целым числом.',
    );
  return parseNormId(Number(value), code);
}

export function parseIssueListQuery(payload: unknown) {
  const values = parsePpeObject(payload, [
    'employeeId',
    'positionId',
    'ppeItemId',
    'issueType',
    'status',
    'dateFrom',
    'dateTo',
  ]);
  const employeeId =
    values.employeeId === undefined
      ? undefined
      : queryNumber(values.employeeId, 'INVALID_EMPLOYEE_ID');
  const positionId =
    values.positionId === undefined
      ? undefined
      : queryNumber(values.positionId, 'INVALID_POSITION_ID');
  const ppeItemId =
    values.ppeItemId === undefined
      ? undefined
      : queryNumber(values.ppeItemId, 'INVALID_PPE_ITEM_ID');
  const issueType = values.issueType;
  if (
    issueType !== undefined &&
    issueType !== PpeIssueType.REGULAR &&
    issueType !== PpeIssueType.EXTRA
  )
    badPpeRequest('INVALID_ISSUE_TYPE', 'Недопустимый тип выдачи.');
  const status = values.status;
  if (
    status !== undefined &&
    status !== PpeIssueStatus.ISSUED &&
    status !== PpeIssueStatus.CANCELLED
  )
    badPpeRequest('INVALID_ISSUE_STATUS', 'Недопустимый статус выдачи.');
  const dateFrom =
    values.dateFrom === undefined ? undefined : parseNormDate(values.dateFrom);
  const dateTo =
    values.dateTo === undefined ? undefined : parseNormDate(values.dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo)
    badPpeRequest('INVALID_NORM_DATE', 'Начало диапазона позже его окончания.');
  return {
    employeeId,
    positionId,
    ppeItemId,
    issueType,
    status,
    dateFrom,
    dateTo,
  };
}

export function parseIssuePlanQuery(payload: unknown, role: unknown) {
  const values = parsePpeObject(payload, ['issuedAt']);
  return parseIssueDay(
    values.issuedAt,
    role,
    Object.hasOwn(values, 'issuedAt'),
  );
}
