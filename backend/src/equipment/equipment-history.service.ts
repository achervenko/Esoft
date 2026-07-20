import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditModule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toAuditUserName } from './equipment-audit.mapper';

@Injectable()
export class EquipmentHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findHistoryByVisibleId(visibleId: number) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { visibleId },
      select: { id: true },
    });

    if (!equipment) {
      throw new NotFoundException('Оборудование не найдено.');
    }

    const history = await this.prisma.auditLog.findMany({
      where: {
        entityId: equipment.id,
        entityType: 'equipment',
        module: AuditModule.EQUIPMENT,
      },
      include: {
        user: {
          include: {
            employeeUser: {
              include: {
                employee: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return history.map((item) => ({
      id: item.id,
      action: item.action,
      createdAt: item.createdAt,
      fieldName: item.fieldName,
      newValue: item.newValue,
      oldValue: item.oldValue,
      timeZone: item.timeZone,
      user: item.user ? toAuditUserName(item.user) : 'Не указан',
    }));
  }
}
