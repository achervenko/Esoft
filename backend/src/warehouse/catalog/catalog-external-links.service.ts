import {
  ConflictException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { AuditAction, AuditModule, type Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import { WarehouseCatalogService } from './catalog.service';
import { assertCatalogTransaction } from './catalog.transaction';
export type ExternalItemIdentity = { sourceSystem: string; externalId: string };
export type ExternalItemBinding = ExternalItemIdentity & {
  itemId: string;
  sourceArticle: string;
  sourceName: string;
};
function key(value: string, max: number) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    value.includes('\0')
  )
    throw new BadRequestException({
      code: 'WAREHOUSE_CATALOG_LINK_INVALID',
      message: 'Некорректный внешний идентификатор.',
    });
  return value.trim();
}
function identity(value: ExternalItemIdentity) {
  return {
    sourceSystem: key(value.sourceSystem, 100),
    externalId: key(value.externalId, 255),
  };
}
@Injectable()
export class WarehouseCatalogExternalLinksService {
  constructor(
    private readonly catalog: WarehouseCatalogService,
    private readonly audit: AuditLogService,
  ) {}
  // Acquire identities before locking consumer documents; ordering is stable for bulk imports.
  async lockIdentities(
    tx: Prisma.TransactionClient,
    values: readonly ExternalItemIdentity[],
  ) {
    assertCatalogTransaction(tx);
    const keys = [
      ...new Set(
        values.map((v) => {
          const i = identity(v);
          return JSON.stringify([
            'warehouse:item-link',
            i.sourceSystem,
            i.externalId,
          ]);
        }),
      ),
    ].sort();
    for (const key of keys)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
  }
  async resolveMany(
    tx: Prisma.TransactionClient,
    values: readonly ExternalItemIdentity[],
  ) {
    assertCatalogTransaction(tx);
    const identities = [
      ...new Map(
        values.map((v) => {
          const i = identity(v);
          return [JSON.stringify(i), i] as const;
        }),
      ).values(),
    ];
    if (!identities.length) return [];
    const links = await tx.warehouseItemExternalLink.findMany({
      where: { OR: identities },
      select: { sourceSystem: true, externalId: true, itemId: true },
    });
    return links.map((l) => ({ ...l, itemId: String(l.itemId) }));
  }
  async find(tx: Prisma.TransactionClient, value: ExternalItemIdentity) {
    assertCatalogTransaction(tx);
    const found = await tx.warehouseItemExternalLink.findUnique({
      where: { sourceSystem_externalId: identity(value) },
      select: { itemId: true },
    });
    return found ? { itemId: String(found.itemId) } : null;
  }
  async bind(
    tx: Prisma.TransactionClient,
    input: ExternalItemBinding,
    actor: string,
  ) {
    assertCatalogTransaction(tx);
    await assertTransactionPermission(
      tx,
      actor,
      'warehouse.catalog.links.manage',
    );
    const source = identity(input);
    for (const [value, max] of [
      [input.sourceArticle, 100],
      [input.sourceName, 255],
    ] as const)
      if (
        typeof value !== 'string' ||
        value.length > max ||
        value.includes('\0')
      )
        throw new BadRequestException({
          code: 'WAREHOUSE_CATALOG_LINK_INVALID',
          message: 'Некорректные исходные данные номенклатуры.',
        });
    await this.lockIdentities(tx, [source]);
    const [item] = await this.catalog.lockItemsForOperation([input.itemId], tx);
    const previous = await this.find(tx, source);
    if (previous) {
      if (previous.itemId !== item.id)
        throw new ConflictException({
          code: 'WAREHOUSE_CATALOG_LINK_CONFLICT',
          message: 'Внешняя позиция уже связана с другим товаром.',
        });
      return previous;
    }
    if (!item.isActive)
      throw new ConflictException({
        code: 'WAREHOUSE_ITEM_INACTIVE',
        message: 'Номенклатура неактивна.',
      });
    const link = await tx.warehouseItemExternalLink.create({
      data: {
        ...source,
        itemId: BigInt(item.id),
        sourceArticle: input.sourceArticle,
        sourceName: input.sourceName,
        confirmedBy: actor,
      },
    });
    await this.audit.writeFieldChanges({
      tx,
      userId: actor,
      module: AuditModule.WAREHOUSE,
      action: AuditAction.CREATE,
      entityType: 'warehouse_item_external_link',
      entityStringId: String(link.id),
      fields: [
        {
          fieldName: 'Связь внешней номенклатуры',
          newValue: {
            ...source,
            itemId: item.id,
            sourceArticle: input.sourceArticle,
            sourceName: input.sourceName,
          },
        },
      ],
    });
    return { itemId: item.id };
  }
}
