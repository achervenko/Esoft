import type { PrismaClient } from '@prisma/client';

export async function seedPositions(prisma: PrismaClient): Promise<void> {
  // Match the baseline's case-insensitive position-name unique index.
  await prisma.$executeRaw`
    INSERT INTO positions (name, is_active)
    VALUES (${'Админ'}, true)
    ON CONFLICT (lower(name)) DO NOTHING
  `;
}
