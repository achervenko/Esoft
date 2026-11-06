import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import { WarehouseStockService } from '../stock/stock.service';
import { stockId } from '../stock/stock.validation';
import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import { WarehouseTransfersService } from './transfers.service';
import { parseConsolidation } from './transfers-consolidation.validation';

@Injectable()
export class WarehouseTransferConsolidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: WarehouseStockService,
    private readonly transfers: WarehouseTransfersService,
  ) {}
  consolidate(value: unknown, actor: string) {
    const input = parseConsolidation(value);
    const hash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return this.prisma.$transaction(
      async (tx) => {
        await assertTransactionPermission(
          tx,
          actor,
          'warehouse.transfers.manage',
        );
        if (input.moves.some((m) => m.moveReservation))
          await assertTransactionPermission(
            tx,
            actor,
            'warehouse.reservations.manage',
          );
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
          const snapshot = previous.snapshot as {
            consolidation?: { hash: string; ids: string[] };
          } | null;
          if (snapshot?.consolidation?.hash !== hash)
            throw new ConflictException({
              code: 'WAREHOUSE_TRANSFER_REQUEST_CONFLICT',
              message: 'Ключ уже использован с другими данными.',
            });
          return { ids: snapshot.consolidation.ids };
        }
        const locations = await tx.warehouseStorageLocation.findMany({
          where: {
            id: {
              in: [
                ...new Set(
                  input.moves
                    .map((m) => m.fromLocationId)
                    .concat(input.toLocationId),
                ),
              ].map(BigInt),
            },
          },
          select: { id: true, warehouseId: true },
        });
        if (
          input.moves.some(
            (m) =>
              locations.find((l) => String(l.id) === m.fromLocationId)
                ?.warehouseId !== BigInt(input.fromWarehouseId),
          )
        )
          throw new ForbiddenException(
            'Исходные места должны принадлежать выбранному складу.',
          );
        for (const id of [...new Set(locations.map((l) => l.warehouseId))].sort(
          (a, b) => (a < b ? -1 : a > b ? 1 : 0),
        ))
          await lockWarehouse(tx, id, true);
        await this.stock.lockBalances(tx, input.itemId, [
          ...new Set(
            input.moves.map((m) => m.fromLocationId).concat(input.toLocationId),
          ),
        ]);
        const ids: string[] = [];
        for (const [index, move] of input.moves.entries()) {
          const digest = createHash('sha256')
            .update(JSON.stringify([actor, input.requestKey, index]))
            .digest('hex');
          const requestKey =
            index === 0
              ? input.requestKey
              : `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
          const result = await this.transfers.createInTransaction(
            tx,
            { ...move, requestKey },
            actor,
          );
          ids.push(result.id);
        }
        const first = await tx.warehouseTransfer.findUniqueOrThrow({
          where: { id: stockId(ids[0], 'id') },
        });
        await tx.warehouseTransfer.update({
          where: { id: first.id },
          data: {
            snapshot: {
              ...(first.snapshot as Prisma.JsonObject),
              consolidation: { hash, ids },
            },
          },
        });
        return { ids };
      },
      { timeout: 30000 },
    );
  }
}
