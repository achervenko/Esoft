import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { hasPermission } from '../../auth/permission-policy';
import { WarehouseStockService } from '../stock/stock.service';
import type { WarehouseReservationManager } from '../reservations/reservation-manager.service';
import { createHash } from 'node:crypto';
import { parseTransfer, transferHash } from './transfers.validation';
import { transferDto } from './transfers.dto';
import {
  prepareTransferExecution,
  executeTransfer,
} from './transfers-execution';
import { WarehouseTransfersQueryService } from './transfers-query.service';
@Injectable()
export class WarehouseTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: WarehouseStockService,
    private readonly audit: AuditLogService,
    private readonly queries: WarehouseTransfersQueryService,
  ) {}
  create(value: unknown, actor: string) {
    const input = parseTransfer(value);
    return this.prisma.$transaction(
      (tx) => this.createInTransaction(tx, input, actor),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );
  }
  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: ReturnType<typeof parseTransfer>,
    actor: string,
    reserved?: { reservationId: string; manager: WarehouseReservationManager },
  ) {
    const hash = reserved
      ? createHash('sha256')
          .update(
            JSON.stringify([
              'reservation-move',
              reserved.reservationId,
              transferHash(input),
            ]),
          )
          .digest('hex')
      : transferHash(input);
    if (typeof actor !== 'string' || !actor) throw new ForbiddenException();
    const [user] = await tx.$queryRaw<
      { role: string | null; banned: boolean | null }[]
    >`SELECT role,banned FROM "user" WHERE id = ${actor} FOR SHARE`;
    if (
      !user ||
      user.banned ||
      !hasPermission(user.role, 'warehouse.transfers.manage') ||
      ((reserved || input.distribution?.reservations.length) &&
        !hasPermission(user.role, 'warehouse.reservations.manage'))
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для перемещения.',
      });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:transfer', actor, input.requestKey])},0))`;
    const previous = await tx.warehouseTransfer.findUnique({
      where: {
        createdByUserId_requestKey: {
          createdByUserId: actor,
          requestKey: input.requestKey,
        },
      },
    });
    if (previous) {
      if (previous.requestHash !== hash)
        throw new ConflictException({
          code: 'WAREHOUSE_TRANSFER_REQUEST_CONFLICT',
          message: 'Ключ уже использован с другими данными.',
        });
      return transferDto(previous);
    }
    const prepared = await prepareTransferExecution(
      tx,
      this.stock,
      input,
      reserved,
    );
    const { item, from, to } = prepared;
    const snapshot = await executeTransfer(
      tx,
      this.stock,
      this.audit,
      input,
      actor,
      prepared,
      reserved,
    );
    const operation = await tx.warehouseTransfer.create({
      data: {
        itemId: item.id,
        fromLocationId: from.id,
        toLocationId: to.id,
        quantity: input.quantity,
        comment: input.comment,
        createdByUserId: actor,
        requestKey: input.requestKey,
        requestHash: hash,
        snapshot,
      },
    });
    const result = transferDto(operation);
    await this.audit.writeFieldChanges({
      tx,
      userId: actor,
      module: AuditModule.WAREHOUSE,
      action: AuditAction.CREATE,
      entityType: 'warehouse_transfer',
      entityStringId: String(operation.id),
      fields: [{ fieldName: 'Перемещение', newValue: result }],
    });
    return result;
  }
  findOne(value: string) {
    return this.queries.findOne(value);
  }
  list(value: unknown) {
    return this.queries.list(value);
  }
}
