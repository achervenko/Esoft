import { AuditAction, AuditModule } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('writes one compact event using the supplied transaction', async () => {
    const root = { auditLog: { create: jest.fn() } };
    const tx = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const service = new AuditLogService(root as unknown as PrismaService);
    await service.writeEvent({
      action: AuditAction.CREATE,
      module: AuditModule.PPE,
      entityType: 'ppe_issue',
      entityId: 1,
      userId: 'actor',
      tx: tx as never,
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: AuditAction.CREATE,
        module: AuditModule.PPE,
        entityType: 'ppe_issue',
        entityId: 1,
        entityStringId: null,
        userId: 'actor',
      },
    });
    expect(root.auditLog.create).not.toHaveBeenCalled();
  });
  it('writes field changes with string entity id', async () => {
    const prisma = {
      auditLog: {
        createMany: jest.fn(),
      },
    };
    const service = new AuditLogService(prisma as unknown as PrismaService);

    await service.writeFieldChanges({
      action: AuditAction.UPDATE,
      entityStringId: '2026-08-03',
      entityType: 'calendar_workday',
      fields: [
        {
          fieldName: 'Рабочий день',
          newValue: false,
          oldValue: true,
        },
      ],
      module: AuditModule.CALENDAR,
      userId: 'user-1',
    });

    expect(prisma.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        {
          action: AuditAction.UPDATE,
          entityId: null,
          entityStringId: '2026-08-03',
          entityType: 'calendar_workday',
          fieldName: 'Рабочий день',
          module: AuditModule.CALENDAR,
          newValue: 'false',
          oldValue: 'true',
          userId: 'user-1',
        },
      ],
    });
  });
});
