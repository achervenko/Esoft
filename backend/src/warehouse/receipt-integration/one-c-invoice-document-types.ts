import type { groupInvoiceLinesByWarehouse } from './one-c-invoice-groups';
import type { invoiceSnapshot } from './one-c-invoice-snapshot';

export type Invoice = ReturnType<typeof invoiceSnapshot>;
export type Group = ReturnType<typeof groupInvoiceLinesByWarehouse>[number];
export type InvoiceImportSource = {
  code: string;
  actorUserId: string;
};
export type GroupResult = {
  operationId: string;
  warehouseId: string;
  rows: number[];
  status:
    | 'IMPORTED'
    | 'UNMAPPED'
    | 'INACTIVE'
    | 'AMBIGUOUS'
    | 'SUSPENDED'
    | 'CONFLICT';
  missingOrders?: string[];
  code?: 'WAREHOUSE_RECEIPT_ORDER_UNRESOLVED';
  conflict?: string;
};
export type InvoiceImportResult = {
  outcome: 'PROCESSED' | 'FAILED' | 'SUPERSEDED';
  code?: string;
  groups: GroupResult[];
};
