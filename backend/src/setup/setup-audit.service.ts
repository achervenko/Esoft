import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import type { SetupRequestMeta } from './setup.types';

@Injectable()
export class SetupAuditService {
  logInitialAdminCreated(
    tx: Prisma.TransactionClient,
    params: {
      employeeId: number;
      meta: SetupRequestMeta;
      userId: string;
    },
  ) {
    return tx.auditLog.create({
      data: {
        action: AuditAction.SETUP_ADMIN_CREATED,
        entityId: null,
        entityStringId: params.userId,
        entityType: 'user',
        fieldName: 'Первый администратор',
        module: AuditModule.USERS,
        newValue: JSON.stringify({
          employeeId: params.employeeId,
          ipAddress: params.meta.ipAddress ?? null,
          origin: params.meta.origin ?? null,
          role: 'admin',
          userAgent: params.meta.userAgent ?? null,
          userId: params.userId,
        }),
        oldValue: null,
        userId: null,
      },
    });
  }
}
