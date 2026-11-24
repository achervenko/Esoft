import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CLOSED_ORDER_STATUS } from '../orders/orders.constants';
import { WarehouseNotificationsService } from './warehouse-notifications.service';

@Injectable()
export class WarehouseNotificationsReconciler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WarehouseNotificationsReconciler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: WarehouseNotificationsService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => this.tick(), 30_000);
    this.timer.unref();
    this.tick();
  }

  private tick() {
    this.running ??= this.reconcile()
      .catch((error: unknown) =>
        this.logger.error('Не удалось сверить складские уведомления.', error),
      )
      .finally(() => {
        this.running = undefined;
      });
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }

  async reconcile() {
    const active = await this.prisma.notification.findMany({
      where: {
        resolvedAt: null,
        type: {
          in: [
            'warehouse.receipt.created',
            'warehouse.receipt.conflict',
            'warehouse.order.reserved',
          ],
        },
        actionKey: { not: null },
      },
      select: { type: true, actionKey: true },
    });
    const receiptIds = new Set<bigint>();
    const orderIds = new Set<string>();
    for (const { type, actionKey } of active) {
      const id = actionKey?.slice(type.length + 1);
      if (!id) continue;
      if (type === 'warehouse.order.reserved') orderIds.add(id);
      else receiptIds.add(BigInt(id));
    }
    const [conflicts, missingReceipts, orders] = await Promise.all([
      this.prisma.warehouseReceipt.findMany({
        where: { source: 'ONE_C', conflict: { not: null } },
        select: { id: true },
      }),
      this.prisma.$queryRaw<{ id: bigint }[]>`
        SELECT r.id FROM warehouse_receipts r
        WHERE r.source = 'ONE_C' AND r.status = 'RECEIVED' AND r.conflict IS NULL
          AND EXISTS (
            SELECT 1 FROM warehouse_receipt_lines l
            WHERE l.receipt_id = r.id AND l.source_type = 'GOODS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.action_key = 'warehouse.receipt.created:' || r.id::text
               OR n.event_key = 'warehouse.receipt.created:' || r.id::text
          )
        ORDER BY r.id LIMIT 100`,
      this.prisma.customerOrder.findMany({
        where: {
          status: CLOSED_ORDER_STATUS,
          reservations: { some: { quantity: { gt: 0 } } },
        },
        select: { id: true },
      }),
    ]);
    for (const { id } of conflicts) receiptIds.add(id);
    const missing = new Set(missingReceipts.map(({ id }) => id));
    for (const id of missing) receiptIds.add(id);
    for (const { id } of orders) orderIds.add(id);

    const options = {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    };
    for (const id of receiptIds) {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          { id: bigint }[]
        >`SELECT id FROM warehouse_receipts WHERE id = ${id} FOR UPDATE`;
        if (rows.length)
          await this.notifications.receipt(tx, id, missing.has(id));
      }, options);
    }
    for (const id of orderIds) {
      await this.prisma.$transaction(
        (tx) => this.notifications.order(tx, id),
        options,
      );
    }
  }
}
