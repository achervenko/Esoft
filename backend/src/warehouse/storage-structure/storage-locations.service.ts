import {
  locationWithWarehouseSelect as select,
  locationWithWarehouseDto as dto,
  type LocationWithWarehouse as Location,
} from './storage-structure.dto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { lockWarehouse } from './storage-structure.policy';
import { AuditLogService } from '../../audit/audit-log.service';
import { hasPermission } from '../../auth/permission-policy';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parseLocation,
  parseStorageLocationQuery,
  parseLocationId,
} from './storage-locations.validation';

const labels = {
  name: 'Наименование',
  isActive: 'Активность',
  warehouseId: 'Склад',
};
function notFound(): never {
  throw new NotFoundException({
    code: 'WAREHOUSE_STORAGE_LOCATION_NOT_FOUND',
    message: 'Место хранения не найдено.',
  });
}

function isWarehouseNameUniqueViolation(
  error: Prisma.PrismaClientKnownRequestError,
) {
  const meta = error.meta;
  if (
    meta?.modelName !== undefined &&
    meta.modelName !== 'WarehouseStorageLocation'
  )
    return false;
  const target: unknown = meta?.target;
  if (target === 'uq_warehouse_storage_locations_warehouse_name') return true;
  // A field name alone is meaningful only for this model.
  const isLocationNameFields = (fields: unknown) =>
    Array.isArray(fields) &&
    fields.length === 2 &&
    fields.includes('name') &&
    (fields.includes('warehouseId') || fields.includes('warehouse_id'));
  if (
    meta?.modelName === 'WarehouseStorageLocation' &&
    isLocationNameFields(target)
  )
    return true;

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
    (('fields' in constraint && isLocationNameFields(constraint.fields)) ||
      ('index' in constraint &&
        constraint.index === 'uq_warehouse_storage_locations_warehouse_name'))
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
      warehouseId,
      isActive,
      limit,
      page,
      offset,
      sortBy,
      sortOrder,
    } = parseStorageLocationQuery(query);
    const search = q?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.WarehouseStorageLocationWhereInput = {
      ...(warehouseId === undefined ? {} : { warehouseId }),
      ...(isActive === undefined ? {} : { isActive }),
      ...(search
        ? {
            OR: ['name'].map((key) => ({
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
    ) as Prisma.WarehouseStorageLocationUncheckedCreateInput;
    return this.mutate(actorUserId, async (tx) => {
      await lockWarehouse(tx, BigInt(data.warehouseId), true);
      await tx.$queryRaw`SELECT id FROM warehouse_storage_locations
        WHERE warehouse_id = ${BigInt(data.warehouseId)} AND name = ${data.name} FOR UPDATE`;
      const previous = await tx.warehouseStorageLocation.findUnique({
        where: {
          warehouseId_name: { warehouseId: data.warehouseId, name: data.name },
        },
        select,
      });
      if (previous?.isActive || (previous && data.isActive === false))
        throw new ConflictException({
          code: 'WAREHOUSE_STORAGE_LOCATION_NAME_CONFLICT',
          message:
            'Место хранения с таким названием уже существует на этом складе.',
        });
      const item = previous
        ? await tx.warehouseStorageLocation.update({
            where: { id: previous.id },
            data: { name: data.name, isActive: true },
            select,
          })
        : await tx.warehouseStorageLocation.create({ data, select });
      await this.writeAudit(
        tx,
        previous ? AuditAction.UPDATE : AuditAction.CREATE,
        previous,
        item,
        actorUserId,
      );
      return dto(item);
    });
  }

  async update(value: string, payload: unknown, actorUserId: string) {
    const id = parseLocationId(value);
    const data = parseLocation(payload);
    return this.mutate(actorUserId, async (tx) => {
      // Parent before child: same order as warehouse deactivation and location creation.
      const reference = await tx.warehouseStorageLocation.findUnique({
        where: { id },
        select: { warehouseId: true },
      });
      if (!reference) notFound();
      await lockWarehouse(tx, reference.warehouseId, data.isActive === true);
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
        isWarehouseNameUniqueViolation(error)
      )
        throw new ConflictException({
          code: 'WAREHOUSE_STORAGE_LOCATION_NAME_CONFLICT',
          message:
            'Место хранения с таким названием уже существует на этом складе.',
        });
      throw error;
    }
  }

  private writeAudit(
    tx: Prisma.TransactionClient,
    action: AuditAction,
    previous: Location | null,
    next: Location,
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
          oldValue:
            key === 'warehouseId'
              ? previous?.warehouseId.toString()
              : previous?.[key],
          newValue:
            key === 'warehouseId' ? next.warehouseId.toString() : next[key],
        })),
    });
  }
}
