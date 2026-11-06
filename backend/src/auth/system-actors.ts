import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
export const SYSTEM_ACTOR_ROLE_PREFIX = 'system:';
export const INTEGRATION_ACTOR_ROLE = `${SYSTEM_ACTOR_ROLE_PREFIX}integration`;
export async function ensureIntegrationActor(
  tx: Prisma.TransactionClient,
  sourceId: string,
  name: string,
) {
  const id = `integration:${sourceId}`;
  const actor = await tx.user.upsert({
    where: { id },
    create: {
      id,
      name,
      email: `${sourceId}@integration.invalid`,
      role: INTEGRATION_ACTOR_ROLE,
      emailVerified: false,
    },
    update: {},
    select: { role: true },
  });
  if (actor.role !== INTEGRATION_ACTOR_ROLE)
    throw new ConflictException({
      code: 'INTEGRATION_ACTOR_CONFLICT',
      message: 'Пользователь интеграции не является системным автором.',
    });
  return id;
}
