import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ppeNotFound, rethrowPpeError } from './ppe.errors';

export async function lockCatalogItem(
  tx: Prisma.TransactionClient,
  id: number,
) {
  await tx.$queryRaw`SELECT id FROM ppe_items WHERE id = ${id} FOR UPDATE`;
  const item = await tx.ppeItem.findUnique({ where: { id } });
  if (!item) ppeNotFound('PPE_ITEM_NOT_FOUND');
  return item;
}

export async function mutateCatalog<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  try {
    return await prisma.$transaction(operation);
  } catch (error) {
    rethrowPpeError(error);
  }
}
