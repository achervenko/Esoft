import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { hasPermission, type Permission } from '../auth/permission-policy';
import { NotificationsService } from '../notifications/notifications.service';
import { CLOSED_ORDER_STATUS } from '../orders/orders.constants';

@Injectable()
export class WarehouseNotificationsService {
  constructor(private readonly notifications: NotificationsService) {}

  private async recipients(
    tx: Prisma.TransactionClient,
    permission: Permission,
  ) {
    const users = await tx.user.findMany({
      where: { OR: [{ banned: false }, { banned: null }] },
      select: { id: true, role: true },
    });
    return users
      .filter(({ role }) => hasPermission(role, permission))
      .map(({ id }) => id);
  }

  async receipt(tx: Prisma.TransactionClient, id: bigint, initial = false) {
    const receipt = await tx.warehouseReceipt.findUniqueOrThrow({
      where: { id },
      select: {
        source: true,
        status: true,
        conflict: true,
        documentNumber: true,
        receivedAt: true,
      },
    });
    if (receipt.source !== 'ONE_C') return;
    const targetPath = `#/warehouse/receipts/${id}`;
    const number = receipt.documentNumber ?? String(id);
    const awaiting = receipt.status === 'RECEIVED' && !receipt.conflict;
    const arrivalKey = `warehouse.receipt.created:${id}`;
    const knownArrival =
      initial &&
      awaiting &&
      (await tx.notification.findFirst({
        where: { OR: [{ actionKey: arrivalKey }, { eventKey: arrivalKey }] },
        select: { id: true },
      }));
    if (!awaiting || (initial && !knownArrival)) {
      await this.notifications.setAction(
        tx,
        arrivalKey,
        awaiting
          ? {
              type: 'warehouse.receipt.created',
              title: 'Новый приход из 1С',
              body: `Получен приход №${number}. Требуется разместить товар на складе.`,
              targetPath,
              occurredAt: receipt.receivedAt,
              recipientIds: await this.recipients(
                tx,
                'warehouse.receipts.place',
              ),
            }
          : null,
      );
    }
    await this.notifications.setAction(
      tx,
      `warehouse.receipt.conflict:${id}`,
      receipt.conflict
        ? {
            type: 'warehouse.receipt.conflict',
            title: 'Конфликт прихода 1С',
            body: `Приход №${number} требует решения.`,
            targetPath,
            occurredAt: receipt.receivedAt,
            recipientIds: await this.recipients(
              tx,
              'warehouse.receipts.resolve',
            ),
          }
        : null,
    );
  }

  async order(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`
      SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'warehouse-order-notification:' + id}, 0))
    `;
    const order = await tx.customerOrder.findFirst({
      where: { id, status: CLOSED_ORDER_STATUS },
      select: { number: true },
    });
    const reserve =
      order &&
      (await tx.warehouseReservation.findFirst({
        where: { orderId: id, quantity: { gt: 0 } },
        select: { id: true },
      }));
    await this.notifications.setAction(
      tx,
      `warehouse.order.reserved:${id}`,
      reserve
        ? {
            type: 'warehouse.order.reserved',
            title: 'Заказ закрыт, товар остался в резерве',
            body: `По заказу №${order?.number ?? id} остался резерв.`,
            targetPath: `#/orders/${id}`,
            occurredAt: new Date(),
            recipientIds: await this.recipients(
              tx,
              'warehouse.reservations.manage',
            ),
          }
        : null,
    );
  }
}
