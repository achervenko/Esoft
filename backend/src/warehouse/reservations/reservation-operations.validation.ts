import { BadRequestException } from '@nestjs/common';
import { stockQuantity } from '../stock/stock.validation';
export function parseReservationOperation(value: unknown) {
  const bad = (): never => {
    throw new BadRequestException({
      code: 'WAREHOUSE_RESERVATION_OPERATION_INVALID',
      message:
        'Укажите действие, количество, комментарий и корректные данные запроса.',
    });
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad();
  const b = value as Record<string, unknown>;
  if (
    Object.keys(b).some(
      (k) =>
        ![
          'action',
          'quantity',
          'expectedQuantity',
          'expectedBorrowedQuantity',
          'requestKey',
          'comment',
          'attachments',
        ].includes(k),
    )
  )
    bad();
  if (!['RELEASE', 'BORROW', 'RESTORE'].includes(String(b.action))) bad();
  const uuid = (v: unknown) => {
    if (
      typeof v !== 'string' ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v)
    )
      bad();
    return (v as string).toLowerCase();
  };
  if (
    typeof b.comment !== 'string' ||
    !b.comment.trim() ||
    b.comment.trim().length > 1000 ||
    b.comment.includes('\0')
  )
    bad();
  if (!Array.isArray(b.attachments) || b.attachments.length > 10) bad();
  const attachments = (b.attachments as unknown[]).map(uuid).sort();
  if (new Set(attachments).size !== attachments.length) bad();
  if (b.action === 'RELEASE' && !attachments.length)
    throw new BadRequestException({
      code: 'WAREHOUSE_RESERVATION_DOCUMENT_REQUIRED',
      message: 'Для снятия резерва прикрепите документ.',
    });
  return {
    action: b.action as 'RELEASE' | 'BORROW' | 'RESTORE',
    quantity: stockQuantity(b.quantity),
    expectedQuantity: stockQuantity(b.expectedQuantity),
    expectedBorrowedQuantity: stockQuantity(b.expectedBorrowedQuantity, true),
    requestKey: uuid(b.requestKey),
    comment: (b.comment as string).trim(),
    attachments,
  };
}
