import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { hasPermission } from '../../auth/permission-policy';

@Injectable()
export class WarehouseStockAdjustmentAccessService {
  async assertAdmin(tx: Prisma.TransactionClient, actorUserId: string) {
    if (typeof actorUserId !== 'string' || !actorUserId)
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Требуются права администратора.',
      });
    const users = await tx.$queryRaw<
      { role: string | null; banned: boolean | null }[]
    >`SELECT role, banned FROM "user" WHERE id = ${actorUserId} FOR SHARE`;
    if (
      !users[0] ||
      users[0].banned ||
      !hasPermission(users[0].role, 'warehouse.adjustments.manage')
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Требуются права администратора.',
      });
  }
}
