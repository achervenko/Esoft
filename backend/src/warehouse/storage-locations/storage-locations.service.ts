import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditModule,
  Prisma,
  type WarehouseStorageLocation,
} from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { hasPermission } from '../../auth/permission-policy';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parseLocation,
  parseLocationQuery,
  parseLocationId,
} from './storage-locations.validation';

const labels = {
  code: 'Код',
  name: 'Наименование',
  isActive: 'Активность',
};
const select = {
  id: true,
  code: true,
  name: true,
  isActive: true,
} satisfies Prisma.WarehouseStorageLocationSelect;

function dto(item: WarehouseStorageLocation) {
  return { ...item, id: item.id.toString() };
}
function notFound(): never {
  throw new NotFoundException({
    code: 'WAREHOUSE_STORAGE_LOCATION_NOT_FOUND',
    message: 'Место хранения не найдено.',
  });
}

function isWarehouseCodeUniqueViolation(
  error: Prisma.PrismaClientKnownRequestError,
) {
  const meta = error.meta;
  if (
    meta?.modelName !== undefined &&
    meta.modelName !== 'WarehouseStorageLocation'
  )
    return false;
  const target: unknown = meta?.target;
  if (target === 'uq_warehouse_storage_locations_code') return true;
  // A field name alone is meaningful only for this model.
  if (meta?.modelName !== 'WarehouseStorageLocation') return false;
  const isCodeField = (fields: unknown) =>
    Array.isArray(fields) && fields.length === 1 && fields[0] === 'code';
  if (target !== undefined) return isCodeField(target);

  // PrismaPg exposes the constraint fields here instead of meta.target.
  const adapter: unknown = meta?.driverAdapterError;
  if (!adapter || typeof adapter !== 'object' || !('cause' in adapter))
    return false;
  const cause: unknown = adapter.cause;
  if (
    !cause ||
    typeof cause !== 'object' ||
    !('kind' in cause) ||
    cause.kind !== 'UniqueConstraintViolation' ||
    !('originalCode' in cause) ||
    cause.originalCode !== '23505' ||
    !('constraint' in cause)
  )
    return false;
  const constraint: unknown = cause.constraint;
  return (
    !!constraint &&
    typeof constraint === 'object' &&
    (('fields' in constraint && isCodeField(constraint.fields)) ||
      ('index' in constraint &&
        constraint.index === 'uq_warehouse_storage_locations_code'))
  );
}

@Injectable()
export class WarehouseStorageLocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(query: unknown) {
    const {
      search: q,
      isActive,
      limit,
      page,
      offset,
      sortBy,
      sortOrder,
    } = parseLocationQuery(query);
    const search = q?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.WarehouseStorageLocationWhereInput = {
      ...(isActive === undefined ? {} : { isActive }),
      ...(search
        ? {
            OR: ['code', 'name'].map((key) => ({
              [key]: { contains: search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const items = await tx.warehouseStorageLocation.findMany({
          where,
          select,
          take: limit,
          skip: offset,
          orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }],
        });
        const total = await tx.warehouseStorageLocation.count({ where });
        return { items: items.map(dto), total, limit, page };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async findOne(value: string) {
    const id = parseLocationId(value);
    const item = await this.prisma.warehouseStorageLocation.findUnique({
      where: { id },
      select: {
        ...select,
        balances: {
          where: { quantity: { gt: 0 } },
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!item) notFound();
    const { balances, ...location } = item;
    return { ...dto(location), hasStock: balances.length > 0 };
  }

  async create(payload: unknown, actorUserId: string) {
    const data = parseLocation(
      payload,
      true,
    ) as Prisma.WarehouseStorageLocationCreateInput;
    return this.mutate(actorUserId, async (tx) => {
      const item = await tx.warehouseStorageLocation.create({ data, select });
      await this.writeAudit(tx, AuditAction.CREATE, null, item, actorUserId);
      return dto(item);
    });
  }

  async update(value: string, payload: unknown, actorUserId: string) {
    const id = parseLocationId(value);
    const data = parseLocation(payload);
    return this.mutate(actorUserId, async (tx) => {
      const previous = await this.lock(tx, id);
      const item = await tx.warehouseStorageLocation.update({
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

  private async lock(tx: Prisma.TransactionClient, id: bigint) {
    await tx.$queryRaw`SELECT id FROM warehouse_storage_locations WHERE id = ${id} FOR UPDATE`;
    const item = await tx.warehouseStorageLocation.findUnique({
      where: { id },
      select,
    });
    if (!item) notFound();
    return item;
  }

  private async mutate<T>(
    actor: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (typeof actor !== 'string' || !actor) throw new ForbiddenException();
        const [user] = await tx.$queryRaw<
          { role: string | null; banned: boolean | null }[]
        >`SELECT role, banned FROM "user" WHERE id = ${actor} FOR SHARE`;
        if (
          !user ||
          user.banned ||
          !hasPermission(user.role, 'warehouse.storage-locations.manage')
        )
          throw new ForbiddenException();
        return fn(tx);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        isWarehouseCodeUniqueViolation(error)
      )
        throw new ConflictException({
          code: 'WAREHOUSE_STORAGE_LOCATION_CODE_CONFLICT',
          message: 'Место хранения с таким кодом уже существует.',
        });
      throw error;
    }
  }

  private writeAudit(
    tx: Prisma.TransactionClient,
    action: AuditAction,
    previous: WarehouseStorageLocation | null,
    next: WarehouseStorageLocation,
    userId: string,
  ) {
    return this.audit.writeFieldChanges({
      action,
      module: AuditModule.WAREHOUSE,
      entityType: 'warehouse_storage_location',
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
