import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { isReadCommitted } from '../prisma/prisma-transaction-isolation';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseNotificationList,
  validateNotification,
  type CreateNotification,
} from './notifications.validation';

const messageSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  targetPath: true,
  occurredAt: true,
  createdAt: true,
  resolvedAt: true,
} satisfies Prisma.NotificationSelect;

function notFound(): never {
  throw new NotFoundException({
    code: 'NOTIFICATION_NOT_FOUND',
    message: 'Уведомление не найдено.',
  });
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async setAction(
    tx: Prisma.TransactionClient,
    key: string,
    input: Omit<CreateNotification, 'eventKey'> | null,
  ) {
    await tx.$queryRaw`
      SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'notification-action:' + key}, 0))
    `;
    const where = { actionKey: key, resolvedAt: null };
    if (!input) {
      await tx.notification.updateMany({
        where,
        data: { resolvedAt: new Date() },
      });
      return;
    }
    if (
      !input.recipientIds.length ||
      (await tx.notification.findFirst({ where, select: { id: true } }))
    )
      return;
    const notification = await this.create(
      { ...input, eventKey: randomUUID() },
      tx,
    );
    await tx.notification.update({
      where: { id: notification.id },
      data: { actionKey: key },
    });
  }

  create(input: CreateNotification, tx?: Prisma.TransactionClient) {
    const recipientIds = validateNotification(input);
    const data = {
      eventKey: input.eventKey,
      type: input.type,
      title: input.title,
      body: input.body,
      targetPath: input.targetPath ?? null,
      occurredAt: new Date(+input.occurredAt),
    };
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify([
          data.type,
          data.title,
          data.body,
          data.targetPath,
          data.occurredAt,
          recipientIds,
        ]),
      )
      .digest('hex');
    const write = async (client: Prisma.TransactionClient) => {
      if (tx && !(await isReadCommitted(client)))
        throw new BadRequestException({
          code: 'NOTIFICATION_ISOLATION_REQUIRED',
          message: 'Создание уведомления требует транзакцию READ COMMITTED.',
        });
      // A single statement inserts the message and every recipient, or neither.
      await client.$executeRaw`
        WITH inserted AS (
          INSERT INTO notifications (id, event_key, request_hash, type, title, body, target_path, occurred_at)
          VALUES (${randomUUID()}::uuid, ${data.eventKey}, ${requestHash}, ${data.type},
            ${data.title}, ${data.body}, ${data.targetPath}, ${data.occurredAt})
          ON CONFLICT (event_key) DO NOTHING
          RETURNING id
        )
        INSERT INTO notification_recipients (notification_id, user_id)
        SELECT inserted.id, recipient.user_id
        FROM inserted CROSS JOIN jsonb_array_elements_text(${JSON.stringify(recipientIds)}::jsonb) AS recipient(user_id)
      `;
      // A new statement sees the winner of a concurrent insert under Read Committed.
      const { requestHash: existingHash, ...existing } =
        await client.notification.findUniqueOrThrow({
          where: { eventKey: data.eventKey },
          select: { ...messageSelect, requestHash: true },
        });
      if (existingHash !== requestHash)
        throw new ConflictException({
          code: 'NOTIFICATION_EVENT_CONFLICT',
          message: 'Ключ события уже использован с другими данными.',
        });
      return existing;
    };
    if (tx) return write(tx);
    return this.prisma.$transaction(write, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }

  async list(userId: string, query: Record<string, unknown>) {
    const { unread, limit, cursor } = parseNotificationList(query);
    const anchor = cursor
      ? await this.prisma.notificationRecipient.findUnique({
          where: { notificationId_userId: { notificationId: cursor, userId } },
          select: { notification: { select: { id: true, occurredAt: true } } },
        })
      : null;
    if (cursor && !anchor) notFound();
    const pivot = anchor?.notification;
    const rows = await this.prisma.notificationRecipient.findMany({
      where: {
        userId,
        ...(unread ? { readAt: null } : {}),
        ...(unread || pivot
          ? {
              notification: {
                ...(unread ? { resolvedAt: null } : {}),
                ...(pivot
                  ? {
                      OR: [
                        { occurredAt: { lt: pivot.occurredAt } },
                        { occurredAt: pivot.occurredAt, id: { lt: pivot.id } },
                      ],
                    }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: [
        { notification: { occurredAt: 'desc' } },
        { notificationId: 'desc' },
      ],
      take: limit + 1,
      select: {
        readAt: true,
        deliveredAt: true,
        notification: { select: { ...messageSelect, actionKey: true } },
      },
    });
    const items = rows
      .slice(0, limit)
      .map(({ notification: { actionKey, ...notification }, ...state }) => ({
        ...notification,
        ...state,
        requiresAction: actionKey !== null,
      }));
    return {
      items,
      nextCursor: rows.length > limit ? items[limit - 1].id : null,
    };
  }

  async unreadCount(userId: string) {
    return {
      count: await this.prisma.notificationRecipient.count({
        where: { userId, readAt: null, notification: { resolvedAt: null } },
      }),
    };
  }

  async feedRevision(userId: string) {
    const [row] = await this.prisma.$queryRaw<{ revision: string }[]>`
      SELECT md5(COALESCE(string_agg(n.id::text, ',' ORDER BY n.id), '')) AS revision
      FROM notification_recipients r
      JOIN notifications n ON n.id = r.notification_id
      WHERE r.user_id = ${userId} AND r.read_at IS NULL AND n.resolved_at IS NULL
    `;
    return row.revision;
  }

  async markRead(userId: string, id: string) {
    const [updated] = await this.prisma.$queryRaw<
      { readAt: Date; deliveredAt: Date }[]
    >`
      UPDATE notification_recipients
      SET read_at = COALESCE(read_at, statement_timestamp()),
          delivered_at = COALESCE(delivered_at, read_at, statement_timestamp())
      WHERE user_id = ${userId} AND notification_id = ${id}::uuid
      RETURNING read_at AS "readAt", delivered_at AS "deliveredAt"
    `;
    if (!updated) notFound();
    return updated;
  }

  async markAllRead(userId: string) {
    const updated = await this.prisma.$executeRaw`
      UPDATE notification_recipients
      SET read_at = statement_timestamp(),
          delivered_at = COALESCE(delivered_at, statement_timestamp())
      WHERE user_id = ${userId} AND read_at IS NULL
        AND EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.id = notification_recipients.notification_id
            AND n.resolved_at IS NULL
        )
    `;
    return { updated };
  }
}
