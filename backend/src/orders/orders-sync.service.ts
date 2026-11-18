import { randomUUID } from 'node:crypto';
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTransactionPermission } from '../auth/transaction-permission';
import { IntegrationRegistry } from '../integrations/integration-registry';
import { IntegrationFailure } from '../integrations/integration-errors';
import {
  ORDERS_FLOW,
  ORDERS_SYNC_TIMEOUT_MS,
  latestOrdersRun,
} from './orders.constants';
import { ordersCollection, readOrders } from './orders-snapshot';
import { applyOrders } from './orders-import';
@Injectable()
export class OrdersSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: IntegrationRegistry,
  ) {}
  async sync(sourceId: string, actor?: string, signal?: AbortSignal) {
    const startedAt = new Date();
    let acquired = false;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (actor)
            await assertTransactionPermission(tx, actor, 'integrations.manage');
          const [lock] = await tx.$queryRaw<
            { locked: boolean }[]
          >`SELECT pg_try_advisory_xact_lock(hashtextextended(${'orders:sync:ONE_C'},0)) AS locked`;
          if (!lock.locked) return { outcome: 'BUSY' as const };
          // Source and flow settings services take FOR UPDATE on this same source row.
          await tx.$queryRaw`SELECT id FROM integration_sources WHERE id=${sourceId}::uuid FOR SHARE`;
          const flow = await tx.integrationFlow.findUnique({
            where: { sourceId_flowCode: { sourceId, flowCode: ORDERS_FLOW } },
            include: { source: true },
          });
          if (!flow)
            throw new NotFoundException({
              code: 'ORDERS_SOURCE_NOT_FOUND',
              message: 'Источник заказов не найден.',
            });
          if (!flow.isActive || !flow.source.isActive) {
            if (actor)
              throw new ConflictException({
                code: 'ORDERS_SOURCE_DISABLED',
                message: 'Обмен заказами выключен.',
              });
            return { outcome: 'DISABLED' as const };
          }
          if (!actor && !ordersSyncDue(flow, startedAt))
            return { outcome: 'NOT_DUE' as const };
          acquired = true;
          this.registry.validateFlow(
            ORDERS_FLOW,
            flow.source.systemType,
            flow.configVersion,
            flow.config,
          );
          const client = this.registry
            .adapter(flow.source.systemType)
            .createHttpClient(flow.source);
          const deadline = AbortSignal.timeout(ORDERS_SYNC_TIMEOUT_MS - 5000);
          const requestSignal = signal
            ? AbortSignal.any([signal, deadline])
            : deadline;
          const rows = await readOrders(
            client,
            ordersCollection(flow.config),
            requestSignal,
          );
          const completedAt = new Date();
          const result = await applyOrders(tx, sourceId, rows, completedAt);
          await tx.integrationFlow.update({
            where: { sourceId_flowCode: { sourceId, flowCode: ORDERS_FLOW } },
            data: {
              lastSuccessAt: completedAt,
              lastErrorAt: null,
              lastErrorCode: null,
            },
          });
          await tx.orderSyncRun.create({
            data: {
              id: randomUUID(),
              sourceId,
              startedAt,
              finishedAt: completedAt,
              outcome: 'SUCCESS',
              ...result,
            },
          });
          return { outcome: 'SUCCESS' as const, ...result };
        },
        { timeout: ORDERS_SYNC_TIMEOUT_MS, maxWait: 5000 },
      );
    } catch (error) {
      if (acquired) {
        const code =
          error instanceof IntegrationFailure
            ? error.code
            : 'ORDERS_SYNC_FAILED';
        // A late failed attempt must not overwrite a newer successful run.
        await this.prisma
          .$transaction(async (tx) => {
            await tx.orderSyncRun.create({
              data: {
                id: randomUUID(),
                sourceId,
                startedAt,
                finishedAt: new Date(),
                outcome: 'FAILED',
                errorCode: code,
              },
            });
            await tx.integrationFlow.updateMany({
              where: {
                sourceId,
                flowCode: ORDERS_FLOW,
                AND: [
                  {
                    OR: [
                      { lastSuccessAt: null },
                      { lastSuccessAt: { lte: startedAt } },
                    ],
                  },
                  {
                    OR: [
                      { lastErrorAt: null },
                      { lastErrorAt: { lte: startedAt } },
                    ],
                  },
                ],
              },
              data: { lastErrorAt: startedAt, lastErrorCode: code },
            });
          })
          .catch(() => undefined);
      }
      throw error;
    }
  }
  async dueSources() {
    return this.prisma.integrationFlow.findMany({
      where: {
        flowCode: ORDERS_FLOW,
        isActive: true,
        source: { isActive: true },
      },
      select: { sourceId: true },
    });
  }
}
export function ordersSyncDue(
  flow: { lastSuccessAt: Date | null; lastErrorAt: Date | null },
  now: Date,
) {
  const due = latestOrdersRun(now);
  return (
    (!flow.lastSuccessAt || flow.lastSuccessAt < due) &&
    (!flow.lastErrorAt || flow.lastErrorAt < due)
  );
}
