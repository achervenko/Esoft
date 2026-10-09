import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';

type PpeAuditValues = Record<string, string | number | boolean | null>;

@Injectable()
export class PpeAuditService {
  constructor(private readonly audit: AuditLogService) {}

  writeChanges(params: {
    action: AuditAction;
    entityType: string;
    entityId: number;
    actorUserId: string;
    previous: PpeAuditValues | null;
    next: PpeAuditValues;
    labels: Record<string, string>;
    tx: Prisma.TransactionClient;
  }) {
    const previous = params.previous ?? {};
    const next = params.next;
    return this.audit.writeFieldChanges({
      action: params.action,
      module: AuditModule.PPE,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.actorUserId,
      tx: params.tx,
      fields: Object.entries(params.labels)
        .filter(([key]) => previous[key] !== next[key])
        .map(([key, fieldName]) => ({
          fieldName,
          oldValue: previous[key],
          newValue: next[key],
        })),
    });
  }
}
