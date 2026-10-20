import { PpeCatalogSizesService } from './ppe-catalog-sizes.service';
import { lockCatalogItem, mutateCatalog } from './ppe-catalog.persistence';
import { ConflictException, Injectable } from '@nestjs/common';
import { AuditAction, PpeItemType } from '@prisma/client';
import { getBusinessTodayDate } from '../application/business-date';
import { PrismaService } from '../prisma/prisma.service';
import { PpeAuditService } from './ppe-audit.service';
import { ppeNotFound } from './ppe.errors';
import {
  badPpeRequest,
  parsePpeItem,
  parsePpeItemCreate,
  parsePpeStatus,
} from './ppe.validation';

const itemLabels = {
  article: 'Артикул СИЗ',
  name: 'Наименование СИЗ',
  unit: 'Единица выдачи',
  type: 'Тип СИЗ',
};
const statusLabels = { isActive: 'Активность' };

@Injectable()
export class PpeCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PpeAuditService,
    private readonly sizes: PpeCatalogSizesService,
  ) {}

  async listItems() {
    const items = await this.prisma.ppeItem.findMany({
      include: this.catalogInclude(),
      orderBy: { name: 'asc' },
    });
    return items.map(({ _count, ...item }) => ({
      ...item,
      hasActiveNorm: _count.normItems > 0,
    }));
  }

  async findItem(id: number) {
    const item = await this.prisma.ppeItem.findUnique({
      where: { id },
      include: this.catalogInclude(),
    });
    if (!item) ppeNotFound('PPE_ITEM_NOT_FOUND');
    const { _count, ...record } = item;
    return { ...record, hasActiveNorm: _count.normItems > 0 };
  }

  private catalogInclude() {
    const today = getBusinessTodayDate();
    return {
      sizes: { orderBy: { value: 'asc' as const } },
      _count: {
        select: {
          normItems: {
            where: {
              norm: {
                effectiveFrom: { lte: today },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
              },
            },
          },
        },
      },
    };
  }

  async listSizes(itemId: number) {
    const item = await this.findItem(itemId);
    return item.sizes;
  }

  createItem(payload: unknown, actorUserId: string) {
    const { data, sizes } = parsePpeItemCreate(payload);
    return mutateCatalog(this.prisma, async (tx) => {
      const item = await tx.ppeItem.create({ data });
      await this.audit.writeChanges({
        action: AuditAction.CREATE,
        entityType: 'ppe_item',
        entityId: item.id,
        actorUserId,
        previous: null,
        next: item,
        labels: { ...itemLabels, ...statusLabels },
        tx,
      });
      await this.sizes.createInitialSizes(tx, item.id, sizes, actorUserId);
      return item;
    });
  }

  updateItem(id: number, payload: unknown, actorUserId: string) {
    const data = parsePpeItem(payload);
    return mutateCatalog(this.prisma, async (tx) => {
      const previous = await lockCatalogItem(tx, id);
      if (previous.type !== data.type) {
        const issueCount = await tx.ppeIssue.count({
          where: { OR: [{ ppeItemId: id }, { normItemPpeItemId: id }] },
        });
        if (issueCount > 0) {
          badPpeRequest(
            'PPE_ITEM_TYPE_IN_USE',
            'Нельзя менять тип СИЗ после появления выдач. Создайте новую позицию.',
          );
        }
      }
      if (previous.type !== data.type && data.type === PpeItemType.OTHER) {
        const sizeCount = await tx.ppeItemSize.count({
          where: { ppeItemId: id },
        });
        if (sizeCount > 0) {
          badPpeRequest(
            'PPE_ITEM_HAS_SIZES',
            'Нельзя установить тип OTHER для позиции с размерами, включая отключённые.',
          );
        }
      }
      if (previous.article !== data.article) {
        const [normCount, issueCount] = await Promise.all([
          tx.ppeNormItem.count({ where: { ppeItemId: id } }),
          tx.ppeIssue.count({ where: { ppeItemId: id } }),
        ]);
        if (normCount > 0 || issueCount > 0) {
          badPpeRequest(
            'PPE_ARTICLE_IN_USE',
            'Нельзя менять артикул СИЗ, используемого в норме или истории выдач. Создайте новую позицию.',
          );
        }
      }
      if (previous.type !== data.type && data.type !== PpeItemType.OTHER) {
        const incompatible = await tx.ppeItemSize.count({
          where: {
            ppeItemId: id,
            heightValue:
              data.type === PpeItemType.BODY || data.type === PpeItemType.TSHIRT
                ? null
                : { not: null },
          },
        });
        if (incompatible > 0)
          badPpeRequest(
            'PPE_SIZE_TYPE_CONFLICT',
            'Размерный ряд не соответствует новому типу СИЗ.',
          );
      }
      if (previous.unit !== data.unit || previous.type !== data.type) {
        const normCount = await tx.ppeNormItem.count({
          where: { ppeItemId: id },
        });
        if (normCount > 0) {
          throw new ConflictException({
            code: 'PPE_ITEM_IN_NORM',
            message:
              'Нельзя менять единицу измерения или тип СИЗ, включённого в норму. Создайте новую позицию и новую редакцию нормы.',
          });
        }
      }
      const item = await tx.ppeItem.update({ where: { id }, data });
      await this.audit.writeChanges({
        action: AuditAction.UPDATE,
        entityType: 'ppe_item',
        entityId: id,
        actorUserId,
        previous,
        next: item,
        labels: itemLabels,
        tx,
      });
      return item;
    });
  }

  setItemStatus(id: number, payload: unknown, actorUserId: string) {
    const isActive = parsePpeStatus(payload);
    return mutateCatalog(this.prisma, async (tx) => {
      const previous = await lockCatalogItem(tx, id);
      const item = await tx.ppeItem.update({
        where: { id },
        data: { isActive },
      });
      await this.audit.writeChanges({
        action: AuditAction.STATUS_CHANGE,
        entityType: 'ppe_item',
        entityId: id,
        actorUserId,
        previous,
        next: item,
        labels: statusLabels,
        tx,
      });
      return item;
    });
  }

  createSize(itemId: number, payload: unknown, actorUserId: string) {
    return this.sizes.createSize(itemId, payload, actorUserId);
  }
  replaceSizes(itemId: number, payload: unknown, actorUserId: string) {
    return this.sizes.replaceSizes(itemId, payload, actorUserId);
  }
  updateSize(
    itemId: number,
    sizeId: number,
    payload: unknown,
    actorUserId: string,
  ) {
    return this.sizes.updateSize(itemId, sizeId, payload, actorUserId);
  }
  setSizeStatus(
    itemId: number,
    sizeId: number,
    payload: unknown,
    actorUserId: string,
  ) {
    return this.sizes.setSizeStatus(itemId, sizeId, payload, actorUserId);
  }
}
