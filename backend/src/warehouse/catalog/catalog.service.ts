import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditModule,
  Prisma,
  type WarehouseItem,
} from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parseCatalogItem,
  parseCatalogQuery,
  parseCatalogStatus,
  parseWarehouseId,
} from './catalog.validation';

const labels = {
  article: 'Артикул',
  name: 'Наименование',
  unit: 'Единица измерения',
  comment: 'Комментарий',
  isActive: 'Активность',
};
const select = {
  id: true,
  article: true,
  name: true,
  unit: true,
  comment: true,
  isActive: true,
} satisfies Prisma.WarehouseItemSelect;

function dto(item: WarehouseItem) {
  return { ...item, id: item.id.toString() };
}
function notFound(): never {
  throw new NotFoundException({
    code: 'WAREHOUSE_ITEM_NOT_FOUND',
    message: 'Номенклатура не найдена.',
  });
}

@Injectable()
export class WarehouseCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(query: unknown) {
    const { q, isActive, limit, offset } = parseCatalogQuery(query);
    const search = q?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.WarehouseItemWhereInput = {
      ...(isActive === undefined ? {} : { isActive }),
      ...(search
        ? {
            OR: ['article', 'name', 'comment'].map((key) => ({
              [key]: { contains: search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const items = await tx.warehouseItem.findMany({
          where,
          select,
          take: limit,
          skip: offset,
          orderBy: [{ article: 'asc' }, { id: 'asc' }],
        });
        const total = await tx.warehouseItem.count({ where });
        return { items: items.map(dto), total, limit, offset };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async findOne(value: string) {
    const id = parseWarehouseId(value);
    const item = await this.prisma.warehouseItem.findUnique({
      where: { id },
      select,
    });
    if (!item) notFound();
    return dto(item);
  }

  async create(payload: unknown, actorUserId: string) {
    const data = parseCatalogItem(
      payload,
      true,
    ) as Prisma.WarehouseItemCreateInput;
    return this.mutate(async (tx) => {
      const item = await tx.warehouseItem.create({ data, select });
      await this.writeAudit(tx, AuditAction.CREATE, null, item, actorUserId);
      return dto(item);
    });
  }

  async update(value: string, payload: unknown, actorUserId: string) {
    const id = parseWarehouseId(value);
    const data = parseCatalogItem(payload);
    return this.mutate(async (tx) => {
      const previous = await this.lock(tx, id);
      if (data.unit !== undefined && data.unit !== previous.unit) {
        const balances = await tx.warehouseBalance.count({
          where: { itemId: id },
        });
        const lines = await tx.warehouseIssueSheetLine.count({
          where: { itemId: id },
        });
        if (balances || lines)
          throw new ConflictException({
            code: 'WAREHOUSE_UNIT_IN_USE',
            message:
              'Нельзя менять единицу номенклатуры, используемой в остатках или листах выдачи.',
          });
      }
      const item = await tx.warehouseItem.update({
        where: { id },
        data,
        select,
      });
      await this.writeAudit(
        tx,
        AuditAction.UPDATE,
        previous,
        item,
        actorUserId,
      );
      return dto(item);
    });
  }

  async setStatus(value: string, payload: unknown, actorUserId: string) {
    const id = parseWarehouseId(value);
    const data = parseCatalogStatus(payload);
    return this.mutate(async (tx) => {
      const previous = await this.lock(tx, id);
      const item = await tx.warehouseItem.update({
        where: { id },
        data,
        select,
      });
      await this.writeAudit(
        tx,
        AuditAction.STATUS_CHANGE,
        previous,
        item,
        actorUserId,
      );
      return dto(item);
    });
  }

  private async lock(tx: Prisma.TransactionClient, id: bigint) {
    await tx.$queryRaw`SELECT id FROM warehouse_items WHERE id = ${id} FOR UPDATE`;
    const item = await tx.warehouseItem.findUnique({ where: { id }, select });
    if (!item) notFound();
    return item;
  }

  private async mutate<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      return await this.prisma.$transaction(fn);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException({
          code: 'WAREHOUSE_ARTICLE_EXISTS',
          message: 'Номенклатура с таким артикулом уже существует.',
        });
      throw error;
    }
  }

  private writeAudit(
    tx: Prisma.TransactionClient,
    action: AuditAction,
    previous: WarehouseItem | null,
    next: WarehouseItem,
    userId: string,
  ) {
    return this.audit.writeFieldChanges({
      action,
      module: AuditModule.WAREHOUSE,
      entityType: 'warehouse_item',
      entityStringId: next.id.toString(),
      userId,
      tx,
      fields: (Object.keys(labels) as (keyof typeof labels)[])
        .filter((key) => previous === null || previous[key] !== next[key])
        .map((key) => ({
          fieldName: labels[key],
          oldValue: previous?.[key],
          newValue: next[key],
        })),
    });
  }
}
