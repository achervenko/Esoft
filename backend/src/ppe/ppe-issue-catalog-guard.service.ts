import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ppeNotFound } from './ppe.errors';
import { badPpeRequest } from './ppe.validation';
import type { IssueNorm } from './ppe-issue-norms-guard.service';

export type IssueCatalogItem = Prisma.PpeItemGetPayload<{
  include: { sizes: true };
}>;
@Injectable()
export class PpeIssueCatalogGuardService {
  async lockCatalog(
    tx: Prisma.TransactionClient,
    ids: number[],
    requireActive: boolean,
  ) {
    const uniqueIds = [...new Set(ids)].sort((a, b) => a - b);
    if (!uniqueIds.length) return new Map<number, IssueCatalogItem>();
    await tx.$queryRaw`SELECT id FROM ppe_items WHERE id IN (${Prisma.join(uniqueIds)}) ORDER BY id FOR UPDATE`;
    const items = await tx.ppeItem.findMany({
      where: { id: { in: uniqueIds } },
      include: { sizes: { orderBy: { id: 'asc' } } },
    });
    if (items.length !== uniqueIds.length) ppeNotFound('PPE_ITEM_NOT_FOUND');
    if (requireActive && items.some((item) => !item.isActive))
      badPpeRequest('PPE_ITEM_INACTIVE', 'Выдавать можно только активные СИЗ.');
    return new Map(items.map((item) => [item.id, item]));
  }

  assertActive(item: IssueCatalogItem) {
    if (!item.isActive)
      badPpeRequest('PPE_ITEM_INACTIVE', 'Выдавать можно только активные СИЗ.');
  }

  assertReplacement(
    normItem: Pick<
      IssueNorm['items'][number],
      'ppeItemTypeSnapshot' | 'ppeUnitSnapshot'
    >,
    actual: Pick<IssueCatalogItem, 'type' | 'unit'>,
  ) {
    if (
      actual.type !== normItem.ppeItemTypeSnapshot ||
      actual.unit !== normItem.ppeUnitSnapshot
    )
      badPpeRequest(
        'PPE_REPLACEMENT_INCOMPATIBLE',
        'Замена должна иметь тот же тип СИЗ и единицу измерения, что и позиция нормы.',
      );
  }
}
