import { AuditAction, AuditModule } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
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
