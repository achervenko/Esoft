import { BadRequestException } from '@nestjs/common';
import {
  invalidInvoiceResponse,
  invoiceRecord,
  invoiceTimestamp,
} from './one-c-invoices.validation';
import {
  optionalText,
  text,
  uuid,
  receiptImportQuantity,
} from '../receipts/receipts-import.contract';

function invoiceLine(value: unknown) {
  const line = invoiceRecord(value);
  const rowNumber = line.row_no;
  if (
    typeof rowNumber !== 'number' ||
    !Number.isSafeInteger(rowNumber) ||
    rowNumber < 1
  )
    invalidInvoiceResponse();
  const orderId = optionalText(line.order_id, 36);
  return {
    rowNumber,
    warehouse: {
      id: uuid(line.warehouse_id),
      name: text(line.warehouse_name, 255),
    },
    item: {
      id: uuid(line.item_id),
      article: optionalText(line.item_article, 100) ?? '',
      name: text(line.item_name, 255),
      unit: optionalText(line.item_unit, 50) ?? '',
      type: text(line.item_type, 30),
    },
    quantity: receiptImportQuantity(
      typeof line.quantity === 'number' ? String(line.quantity) : line.quantity,
      true,
    ).toString(),
    order: orderId
      ? {
          id: uuid(orderId),
          number: optionalText(line.order_number, 100) ?? '',
        }
      : null,
  };
}

export function invoiceSnapshot(value: unknown) {
  try {
    const { id, number, date, status, lines } = invoiceRecord(value);
    if (
      !invoiceTimestamp(date) ||
      (status !== 'POSTED' && status !== 'CREATED' && status !== 'CANCELED') ||
      !Array.isArray(lines)
    )
      invalidInvoiceResponse();
    const positions = lines.map(invoiceLine);
    if (
      new Set(positions.map((line) => line.rowNumber)).size !== positions.length
    )
      invalidInvoiceResponse();
    return {
      id: uuid(id),
      number: text(number, 100),
      date,
      status,
      lines: positions,
    };
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    invalidInvoiceResponse();
  }
}
