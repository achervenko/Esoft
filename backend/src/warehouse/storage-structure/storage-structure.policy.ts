import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
export function warehouseNotFound(): never {
  throw new NotFoundException({
    code: 'WAREHOUSE_NOT_FOUND',
    message: 'Склад не найден.',
  });
}
// Accept the caller's transaction so the check and subsequent changes share a lock lifetime.
export async function lockWarehouse(
  tx: Prisma.TransactionClient,
  id: bigint,
  requireActive = false,
) {
  const [row] = await tx.$queryRaw<
    { id: bigint; is_active: boolean }[]
  >`SELECT id, is_active FROM warehouses WHERE id = ${id} FOR SHARE`;
  if (!row) warehouseNotFound();
  if (requireActive && !row.is_active)
    throw new ConflictException({
      code: 'WAREHOUSE_INACTIVE',
      message: 'Склад неактивен.',
    });
}
