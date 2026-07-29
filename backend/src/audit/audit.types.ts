import type { AuditAction, AuditModule, Prisma } from '@prisma/client';

export type AuditFieldChange = {
  fieldName: string;
  newValue: unknown;
  oldValue?: unknown;
};

export type WriteAuditParams = {
  action: AuditAction;
  entityId?: number | null;
  entityStringId?: string | null;
  entityType: string;
  fields: AuditFieldChange[];
  module: AuditModule;
  tx?: Prisma.TransactionClient;
  userId?: string | null;
};
