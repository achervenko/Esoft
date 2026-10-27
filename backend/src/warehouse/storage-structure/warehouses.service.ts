import {
  warehouseSelect as select,
  warehouseDto as dto,
} from './storage-structure.dto';
import { warehouseNotFound as missing } from './storage-structure.policy';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AuditAction,
  AuditModule,
  Prisma,
  type Warehouse,
} from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { hasPermission } from '../../auth/permission-policy';
import { PrismaService } from '../../prisma/prisma.service';
import {
  parseLocationId,
  parseLocationQuery,
  parseStorageEntry,
} from './storage-locations.validation';

function isWarehouseCodeUniqueViolation(
  error: Prisma.PrismaClientKnownRequestError,
) {
  const meta = error.meta;
  if (meta?.modelName !== undefined && meta.modelName !== 'Warehouse')
    return false;
  const constraintName = 'uq_warehouses_code';
  const isCodeField = (fields: unknown) =>
    meta?.modelName === 'Warehouse' &&
    Array.isArray(fields) &&
    fields.length === 1 &&
    fields[0] === 'code';
  if (meta?.target === constraintName || isCodeField(meta?.target)) return true;
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
    (('index' in constraint && constraint.index === constraintName) ||
      ('fields' in constraint && isCodeField(constraint.fields)))
  );
}

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(value: unknown) {
    const { search, isActive, page, limit, offset, sortBy, sortOrder } =
      parseLocationQuery(value);
    const q = search?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.WarehouseWhereInput = {
      ...(isActive === undefined ? {} : { isActive }),
      ...(q
        ? {
            OR: ['code', 'name'].map((key) => ({
              [key]: { contains: q, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const items = await tx.warehouse.findMany({
          where,
          select,
          skip: offset,
          take: limit,
          orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }],
        });
        const total = await tx.warehouse.count({ where });
        return { items: items.map(dto), total, page, limit };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async findOne(value: string) {
    const row = await this.prisma.warehouse.findUnique({
      where: { id: parseLocationId(value) },
      select,
    });
    if (!row) missing();
    return dto(row);
  }
  create(value: unknown, actor: string) {
    const data = parseStorageEntry(value, true) as Prisma.WarehouseCreateInput;
    return this.mutate(actor, async (tx) => {
      const row = await tx.warehouse.create({ data, select });
      await this.writeAudit(tx, actor, null, row);
      return dto(row);
    });
  }
  update(value: string, body: unknown, actor: string) {
    const id = parseLocationId(value);
    const data = parseStorageEntry(body);
    return this.mutate(actor, async (tx) => {
      await tx.$queryRaw`SELECT id FROM warehouses WHERE id = ${id} FOR UPDATE`;
      const previous = await tx.warehouse.findUnique({ where: { id }, select });
      if (!previous) missing();
      // Locations acquire parent SHARE before creation/activation, so this check cannot race.
      if (
        data.isActive === false &&
        (await tx.warehouseStorageLocation.count({
          where: { warehouseId: id, isActive: true },
        }))
      )
        throw new ConflictException({
          code: 'WAREHOUSE_HAS_ACTIVE_LOCATIONS',
          message: 'Сначала деактивируйте места хранения этого склада.',
        });
      const row = await tx.warehouse.update({ where: { id }, data, select });
      await this.writeAudit(tx, actor, previous, row);
      return dto(row);
    });
  }
  private async mutate<T>(
    actor: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
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
        return action(tx);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        isWarehouseCodeUniqueViolation(error)
      )
        throw new ConflictException({
          code: 'WAREHOUSE_CODE_CONFLICT',
          message: 'Склад с таким кодом уже существует.',
        });
      throw error;
    }
  }
  private writeAudit(
    tx: Prisma.TransactionClient,
    userId: string,
    before: Warehouse | null,
    after: Warehouse,
  ) {
    const labels = {
      code: 'Код',
      name: 'Наименование',
      isActive: 'Активность',
    };
    return this.audit.writeFieldChanges({
      tx,
      userId,
      module: AuditModule.WAREHOUSE,
      entityType: 'warehouse',
      entityStringId: String(after.id),
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      fields: (Object.keys(labels) as (keyof typeof labels)[])
        .filter((key) => !before || before[key] !== after[key])
        .map((key) => ({
          fieldName: labels[key],
          oldValue: before?.[key],
          newValue: after[key],
        })),
    });
  }
}
