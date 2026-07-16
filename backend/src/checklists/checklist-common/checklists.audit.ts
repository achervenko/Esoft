import { AuditAction, AuditModule, type Prisma } from '@prisma/client';

export function writeChecklistAudit(
  tx: Prisma.TransactionClient,
  params: {
    action: AuditAction;
    entityId?: number | null;
    entityType: string;
    fieldName: string;
    newValue?: unknown;
    oldValue?: unknown;
    userId?: string | null;
  },
) {
  return tx.auditLog.create({
    data: {
      action: params.action,
      entityId: params.entityId ?? null,
      entityType: params.entityType,
      fieldName: params.fieldName,
      module: AuditModule.EQUIPMENT,
      newValue: formatAuditValue(params.newValue),
      oldValue: formatAuditValue(params.oldValue),
      userId: params.userId ?? null,
    },
  });
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}
