import { INTEGRATION_ACTOR_ROLE } from './system-actors';
import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { hasPermission, type Permission } from './permission-policy';
export async function assertTransactionPermission(
  tx: Prisma.TransactionClient,
  actor: string,
  permission: Permission,
  integrationSourceCode?: string,
) {
  const [user] = await tx.$queryRaw<
    { role: string | null; banned: boolean | null }[]
  >`SELECT role,banned FROM "user" WHERE id=${actor} FOR SHARE`;
  const integrationGrant =
    user?.role === INTEGRATION_ACTOR_ROLE &&
    !user.banned &&
    !!integrationSourceCode &&
    !!(await tx.systemActorPermission.findFirst({
      where: {
        actorUserId: actor,
        permission,
        sourceActor: { source: { code: integrationSourceCode } },
      },
      select: { sourceId: true },
    }));
  if (
    !user ||
    user.banned ||
    (!integrationGrant && !hasPermission(user.role, permission))
  )
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав.',
    });
}
