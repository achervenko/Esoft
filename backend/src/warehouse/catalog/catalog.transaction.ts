import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
export function assertCatalogTransaction(tx: Prisma.TransactionClient) {
  if (
    !tx ||
    typeof tx.$queryRaw !== 'function' ||
    typeof (tx as unknown as { $connect?: unknown }).$connect === 'function'
  )
    throw new BadRequestException({
      code: 'WAREHOUSE_CATALOG_TRANSACTION_REQUIRED',
      message: 'Передайте транзакцию, а не корневой PrismaClient.',
    });
}
