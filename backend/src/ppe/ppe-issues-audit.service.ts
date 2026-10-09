import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class PpeIssuesAuditService {
  constructor(private readonly audit: AuditLogService) {}

  created(tx: Prisma.TransactionClient, issueId: number, actorUserId: string) {
    return this.audit.writeEvent({
      tx,
      module: AuditModule.PPE,
      action: AuditAction.CREATE,
      entityType: 'ppe_issue',
      entityId: issueId,
      userId: actorUserId,
    });
  }

  cancelled(
    tx: Prisma.TransactionClient,
    issueId: number,
    reason: string,
    actorUserId: string,
  ) {
    return this.audit.writeFieldChanges({
      tx,
      module: AuditModule.PPE,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'ppe_issue',
      entityId: issueId,
      userId: actorUserId,
      fields: [
        {
          fieldName: 'Статус выдачи',
          oldValue: 'ISSUED',
          newValue: 'CANCELLED',
        },
        { fieldName: 'Причина отмены', oldValue: null, newValue: reason },
      ],
    });
  }
}
