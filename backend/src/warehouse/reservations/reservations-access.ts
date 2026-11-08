import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { hasPermission, type Permission } from '../../auth/permission-policy';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';

export async function assertReservationAccess(
  tx: Prisma.TransactionClient,
  actor: string,
  permission: Permission = WAREHOUSE_PERMISSIONS.RESERVATIONS_READ,
  lock = false,
) {
  const user = !lock
    ? await tx.user.findUnique({
        where: { id: actor },
        select: { role: true, banned: true },
      })
    : (
        await tx.$queryRaw<{ role: string | null; banned: boolean | null }[]>`
        SELECT role, banned FROM "user" WHERE id = ${actor} FOR SHARE
      `
      )[0];
  if (!user || user.banned || !hasPermission(user.role, permission))
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для этой операции.',
    });
}
