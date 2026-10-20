import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type Gender } from '@prisma/client';
import { ppeNotFound } from './ppe.errors';
import { normInclude } from './ppe-norms.mapper';
import type { parseNormRevision } from './ppe-norms.validation';
import { badPpeRequest } from './ppe.validation';

type NormContent = ReturnType<typeof parseNormRevision>;

@Injectable()
export class PpeNormsGuardsService {
  async lockPosition(tx: Prisma.TransactionClient, positionId: number) {
    await tx.$queryRaw`SELECT id FROM positions WHERE id = ${positionId} FOR UPDATE`;
    const position = await tx.position.findUnique({
      where: { id: positionId },
    });
    if (!position) ppeNotFound('POSITION_NOT_FOUND');
    if (!position.isActive)
      badPpeRequest(
        'POSITION_INACTIVE',
        'Нельзя создавать или исправлять норму отключённой должности.',
      );
  }

  async lockNorm(tx: Prisma.TransactionClient, id: number) {
    const initial = await tx.ppeNorm.findUnique({
      where: { id },
      select: { positionId: true },
    });
    if (!initial) ppeNotFound('PPE_NORM_NOT_FOUND');
    await this.lockPosition(tx, initial.positionId);
    await tx.$queryRaw`SELECT id FROM ppe_norms WHERE id = ${id} FOR UPDATE`;
    const norm = await tx.ppeNorm.findUnique({
      where: { id },
      include: normInclude,
    });
    if (!norm) ppeNotFound('PPE_NORM_NOT_FOUND');
    return norm;
  }

  async lockCatalog(tx: Prisma.TransactionClient, items: NormContent['items']) {
    const ids = items.map((item) => item.ppeItemId).sort((a, b) => a - b);
    await tx.$queryRaw`SELECT id FROM ppe_items WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    const catalog = await tx.ppeItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, isActive: true },
    });
    if (catalog.length !== ids.length) ppeNotFound('PPE_ITEM_NOT_FOUND');
    if (catalog.some((item) => !item.isActive))
      badPpeRequest(
        'PPE_ITEM_INACTIVE',
        'В новой или исправленной норме можно использовать только активные СИЗ.',
      );
  }

  async assertNoOverlap(
    tx: Prisma.TransactionClient,
    positionId: number,
    data: NormContent & { gender: Gender },
    excludeId?: number | number[],
  ) {
    const existing = await tx.ppeNorm.findFirst({
      where: {
        positionId,
        gender: data.gender,
        ...(excludeId === undefined
          ? {}
          : {
              id: { notIn: Array.isArray(excludeId) ? excludeId : [excludeId] },
            }),
        ...(data.effectiveTo === null
          ? {}
          : { effectiveFrom: { lte: data.effectiveTo } }),
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: data.effectiveFrom } },
        ],
      },
      select: { id: true },
    });
    if (existing) this.periodConflict();
  }

  periodConflict(): never {
    throw new ConflictException({
      code: 'PPE_NORM_PERIOD_CONFLICT',
      message: 'Период действия пересекается с другой редакцией нормы.',
    });
  }

  locked(): never {
    throw new ConflictException({
      code: 'PPE_NORM_LOCKED',
      message:
        'Нельзя переписывать действующую, историческую или связанную с выдачами норму. Создайте новую редакцию.',
    });
  }
}
