import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ORDERS_FLOW } from './orders.constants';
import { ordersQuery, orderId } from './orders.validation';
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}
  async list(value: unknown) {
    const q = ordersQuery(value);
    const search = q.search?.replace(/[\\%_]/g, '\\$&');
    const where: Prisma.CustomerOrderWhereInput = {
      posted: true,
      deletionMark: q.deleted === 'all' ? undefined : q.deleted === 'true',
      sourceId: q.sourceId,
      missingChecks:
        q.missing === undefined
          ? undefined
          : q.missing === 'true'
            ? 2
            : { lt: 2 },
      ...(q.statuses?.length ? { status: { in: q.statuses } } : {}),
      ...(q.closed === 'true'
        ? { status: 'Закрыт' }
        : q.closed === 'false'
          ? { status: { not: 'Закрыт' } }
          : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => ({
        items: await tx.customerOrder.findMany({
          where,
          include: { source: { select: { name: true } } },
          orderBy: [{ number: 'asc' }, { id: 'asc' }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        }),
        total: await tx.customerOrder.count({ where }),
        statuses: (
          await tx.customerOrder.groupBy({
            by: ['status'],
            where: { posted: true },
            orderBy: { status: 'asc' },
          })
        ).map((row) => row.status),
        page: q.page,
        limit: q.limit,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async findOne(value: string) {
    const row = await this.prisma.customerOrder.findUnique({
      where: { id: orderId(value) },
      include: { source: { select: { name: true } } },
    });
    if (!row)
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Заказ не найден.',
      });
    return row;
  }
  async history(value: string, query: unknown) {
    await this.findOne(value);
    const q = ordersQuery(query);
    return this.prisma.$transaction(
      async (tx) => ({
        items: (
          await tx.customerOrderChange.findMany({
            where: { orderId: orderId(value) },
            orderBy: { id: 'desc' },
            skip: (q.page - 1) * q.limit,
            take: q.limit,
          })
        ).map((r) => ({ ...r, id: String(r.id) })),
        total: await tx.customerOrderChange.count({
          where: { orderId: orderId(value) },
        }),
        page: q.page,
        limit: q.limit,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async sources() {
    return (
      await this.prisma.integrationFlow.findMany({
        where: { flowCode: ORDERS_FLOW },
        select: {
          sourceId: true,
          isActive: true,
          lastSuccessAt: true,
          lastErrorAt: true,
          lastErrorCode: true,
          source: {
            select: {
              name: true,
              isActive: true,
              orderSyncRuns: {
                take: 10,
                orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
                select: {
                  id: true,
                  startedAt: true,
                  finishedAt: true,
                  outcome: true,
                  received: true,
                  changed: true,
                  errorCode: true,
                },
              },
            },
          },
        },
        orderBy: { sourceId: 'asc' },
      })
    ).map((f) => ({
      id: f.sourceId,
      name: f.source.name,
      isActive: f.isActive && f.source.isActive,
      runs: f.source.orderSyncRuns,
      lastSuccessAt: f.lastSuccessAt,
      lastErrorAt: f.lastErrorAt,
      lastErrorCode: f.lastErrorCode,
    }));
  }
}
