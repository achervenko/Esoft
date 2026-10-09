import { ConflictException, Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PpeAuditService } from './ppe-audit.service';
import { ppeNotFound } from './ppe.errors';
import {
  assertPpeSizeType,
  parsePpeSize,
  parsePpeSizeSet,
  parsePpeStatus,
} from './ppe.validation';
import { lockCatalogItem, mutateCatalog } from './ppe-catalog.persistence';
const sizeLabels = { value: 'Размер СИЗ', heightValue: 'Ростовка СИЗ' };
const statusLabels = { isActive: 'Активность' };
@Injectable()
export class PpeCatalogSizesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PpeAuditService,
  ) {}

  /** Initial sizes participate in the item creation transaction and its audit. */
  async createInitialSizes(
    tx: Prisma.TransactionClient,
    itemId: number,
    sizes: ReturnType<typeof parsePpeSize>[],
    actorUserId: string,
  ) {
    for (const sizeData of sizes) {
      const size = await this.writeSize(() =>
        tx.ppeItemSize.create({ data: { ...sizeData, ppeItemId: itemId } }),
      );
      await this.audit.writeChanges({
        action: AuditAction.CREATE,
        entityType: 'ppe_item_size',
        entityId: size.id,
        actorUserId,
        previous: null,
        next: size,
        labels: { ppeItemId: 'Позиция СИЗ', ...sizeLabels, ...statusLabels },
        tx,
      });
    }
  }
  createSize(itemId: number, payload: unknown, actorUserId: string) {
    const data = parsePpeSize(payload);
    return mutateCatalog(this.prisma, async (tx) => {
      const item = await lockCatalogItem(tx, itemId);
      assertPpeSizeType(item.type, data.heightValue);
      const size = await this.writeSize(() =>
        tx.ppeItemSize.create({
          data: { ...data, ppeItemId: itemId },
        }),
      );
      await this.audit.writeChanges({
        action: AuditAction.CREATE,
        entityType: 'ppe_item_size',
        entityId: size.id,
        actorUserId,
        previous: null,
        next: size,
        labels: { ppeItemId: 'Позиция СИЗ', ...sizeLabels, ...statusLabels },
        tx,
      });
      return size;
    });
  }

  replaceSizes(itemId: number, payload: unknown, actorUserId: string) {
    const desired = parsePpeSizeSet(payload);
    return mutateCatalog(this.prisma, async (tx) => {
      const item = await lockCatalogItem(tx, itemId);
      for (const size of desired)
        assertPpeSizeType(item.type, size.heightValue);
      const previous = await tx.ppeItemSize.findMany({
        where: { ppeItemId: itemId },
      });
      const key = (size: { value: string; heightValue: string | null }) =>
        JSON.stringify([size.value, size.heightValue]);
      const requested = new Set(desired.map(key));
      const existing = new Map(previous.map((size) => [key(size), size]));
      for (const data of desired) {
        const old = existing.get(key(data));
        if (old) continue;
        const created = await this.writeSize(() =>
          tx.ppeItemSize.create({ data: { ...data, ppeItemId: itemId } }),
        );
        await this.audit.writeChanges({
          action: AuditAction.CREATE,
          entityType: 'ppe_item_size',
          entityId: created.id,
          actorUserId,
          previous: null,
          next: created,
          labels: { ppeItemId: 'Позиция СИЗ', ...sizeLabels, ...statusLabels },
          tx,
        });
      }
      for (const old of previous) {
        const isActive = requested.has(key(old));
        if (old.isActive === isActive) continue;
        const next = await tx.ppeItemSize.update({
          where: { id: old.id },
          data: { isActive },
        });
        await this.audit.writeChanges({
          action: AuditAction.STATUS_CHANGE,
          entityType: 'ppe_item_size',
          entityId: old.id,
          actorUserId,
          previous: old,
          next,
          labels: statusLabels,
          tx,
        });
      }
      return tx.ppeItemSize.findMany({
        where: { ppeItemId: itemId },
        orderBy: { value: 'asc' },
      });
    });
  }

  updateSize(
    itemId: number,
    sizeId: number,
    payload: unknown,
    actorUserId: string,
  ) {
    const data = parsePpeSize(payload);
    return mutateCatalog(this.prisma, async (tx) => {
      const previous = await this.lockSize(tx, itemId, sizeId);
      const item = await tx.ppeItem.findUniqueOrThrow({
        where: { id: itemId },
      });
      assertPpeSizeType(item.type, data.heightValue);
      const size = await this.writeSize(() =>
        tx.ppeItemSize.update({ where: { id: sizeId }, data }),
      );
      await this.audit.writeChanges({
        action: AuditAction.UPDATE,
        entityType: 'ppe_item_size',
        entityId: sizeId,
        actorUserId,
        previous,
        next: size,
        labels: sizeLabels,
        tx,
      });
      return size;
    });
  }

  setSizeStatus(
    itemId: number,
    sizeId: number,
    payload: unknown,
    actorUserId: string,
  ) {
    const isActive = parsePpeStatus(payload);
    return mutateCatalog(this.prisma, async (tx) => {
      const previous = await this.lockSize(tx, itemId, sizeId);
      const size = await tx.ppeItemSize.update({
        where: { id: sizeId },
        data: { isActive },
      });
      await this.audit.writeChanges({
        action: AuditAction.STATUS_CHANGE,
        entityType: 'ppe_item_size',
        entityId: sizeId,
        actorUserId,
        previous,
        next: size,
        labels: statusLabels,
        tx,
      });
      return size;
    });
  }

  private async writeSize<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException({
          code: 'PPE_ITEM_SIZE_CONFLICT',
          message: 'Такой размер и ростовка уже существуют у этой позиции СИЗ.',
        });
      throw error;
    }
  }

  private async lockSize(
    tx: Prisma.TransactionClient,
    itemId: number,
    sizeId: number,
  ) {
    await lockCatalogItem(tx, itemId);
    await tx.$queryRaw`SELECT id FROM ppe_item_sizes WHERE id = ${sizeId} FOR UPDATE`;
    const size = await tx.ppeItemSize.findUnique({ where: { id: sizeId } });
    if (!size || size.ppeItemId !== itemId) ppeNotFound('PPE_SIZE_NOT_FOUND');
    return size;
  }
}
