import { IntegrationRegistry } from './integration-registry';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MachineApiKeysService } from '../auth/machine-api-keys.service';
import { AuditLogService } from '../audit/audit-log.service';
import { isPermission } from '../auth/permission-policy';
import { assertTransactionPermission } from '../auth/transaction-permission';
import {
  eventEnvelope,
  eventHash,
  object,
  invalid,
  text,
} from './integration.validation';
@Injectable()
export class IntegrationEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: MachineApiKeysService,
    private readonly audit: AuditLogService,
    private readonly registry: IntegrationRegistry,
  ) {}
  async accept(
    sourceCode: string,
    flowCode: string,
    value: unknown,
    authorization?: string,
  ) {
    const key = await this.keys.verifyBearer(authorization, {
      [flowCode]: ['event:create'],
    });
    const event = eventEnvelope(value),
      requestHash = eventHash(event);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM integration_sources WHERE code=${sourceCode} FOR SHARE`;
      const source = await tx.integrationSource.findUnique({
        where: { code: sourceCode },
      });
      const metadata = key.metadata;
      if (
        !source?.isActive ||
        key.referenceId !== source.actorUserId ||
        !metadata ||
        typeof metadata !== 'object' ||
        !('purpose' in metadata) ||
        metadata.purpose !== 'integration' ||
        !('sourceId' in metadata) ||
        metadata.sourceId !== source.id
      )
        throw new UnauthorizedException({
          code: 'INTEGRATION_SOURCE_UNAUTHORIZED',
          message: 'Неверные учётные данные источника.',
        });
      const actor = await tx.user.findUnique({
        where: { id: source.actorUserId },
        select: { banned: true },
      });
      if (!actor || actor.banned)
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Недостаточно прав.',
        });
      await tx.$queryRaw`SELECT source_id FROM integration_flows WHERE source_id=${source.id}::uuid AND flow_code=${flowCode} FOR SHARE`;
      const flow = await tx.integrationFlow.findUnique({
        where: { sourceId_flowCode: { sourceId: source.id, flowCode } },
      });
      if (!flow?.isActive)
        throw new ConflictException({
          code: 'INTEGRATION_FLOW_INACTIVE',
          message: 'Поток не подключён или отключён.',
        });
      const handler = this.registry.findFlow(flowCode);
      for (const permission of handler?.actorPermissions ?? []) {
        if (!isPermission(permission))
          invalid('Неизвестное разрешение обработчика.');
        await assertTransactionPermission(
          tx,
          source.actorUserId,
          permission,
          source.code,
        );
      }
      handler?.validateEvent(event);
      // Admission must survive a temporarily unavailable owner module. Its handler validates business data on execution.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['integration:event', source.id, flowCode, event.eventId])},0))`;
      const identity = {
        sourceId: source.id,
        flowCode,
        eventId: event.eventId,
      };
      const previous = await tx.integrationEvent.findUnique({
        where: { sourceId_flowCode_eventId: identity },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new ConflictException({
            code: 'INTEGRATION_EVENT_CONFLICT',
            message: 'eventId уже использован с другими данными.',
          });
        return {
          id: String(previous.id),
          eventId: previous.eventId,
          status: previous.status,
        };
      }
      const stored = await tx.integrationEvent.create({
        data: {
          ...identity,
          objectId: event.objectId,
          type: event.type,
          version: event.version,
          requestHash,
        },
      });
      return {
        id: String(stored.id),
        eventId: stored.eventId,
        status: stored.status,
      };
    });
  }
  async list(value: unknown, actor: string) {
    const q = object(value ?? {}, [
      'sourceId',
      'flowCode',
      'status',
      'receivedFrom',
      'receivedTo',
      'page',
      'limit',
    ]);
    const page = q.page === undefined ? 1 : Number(q.page),
      limit = q.limit === undefined ? 50 : Number(q.limit);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000000 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      invalid('Некорректная пагинация.');
    if (q.status !== undefined && typeof q.status !== 'string')
      invalid('Некорректный статус.');
    const status = q.status;
    if (
      status &&
      !['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED'].includes(
        status,
      )
    )
      invalid('Некорректный статус.');
    const date = (v: unknown) => {
      if (v === undefined) return undefined;
      if (
        typeof v !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) ||
        !Number.isFinite(Date.parse(v))
      )
        invalid('Ожидается дата со временем и часовым поясом.');
      return new Date(v);
    };
    const from = date(q.receivedFrom),
      to = date(q.receivedTo);
    if (from && to && from > to) invalid('Некорректный период.');
    if (
      q.sourceId !== undefined &&
      (typeof q.sourceId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          q.sourceId,
        ))
    )
      invalid('Некорректный ID источника.');
    const where: Prisma.IntegrationEventWhereInput = {
      sourceId: q.sourceId,
      flowCode: q.flowCode === undefined ? undefined : text(q.flowCode, 100),
      status,
      receivedAt: { gte: from, lte: to },
    };
    return this.prisma.$transaction(
      async (tx) => {
        await assertTransactionPermission(tx, actor, 'integrations.manage');
        const items = await tx.integrationEvent.findMany({
          where,
          include: {
            flow: {
              select: { source: { select: { code: true, name: true } } },
            },
          },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        });
        return {
          items: items.map((e) => ({
            ...e,
            id: String(e.id),
            sourceCode: e.flow.source.code,
            sourceName: e.flow.source.name,
            flow: undefined,
            leaseToken: undefined,
            leaseOwner: undefined,
          })),
          total: await tx.integrationEvent.count({ where }),
          page,
          limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async history(id: bigint, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await assertTransactionPermission(tx, actor, 'integrations.manage');
        const event = await tx.integrationEvent.findUnique({ where: { id } });
        if (!event) throw new NotFoundException();
        const { leaseToken, leaseOwner, ...publicEvent } = event;
        void leaseToken;
        void leaseOwner;
        const attempts = await tx.integrationAttempt.findMany({
          where: { eventId: id },
          orderBy: { startedAt: 'desc' },
          take: 100,
        });
        return {
          ...publicEvent,
          id: String(event.id),
          attempts: attempts.map(({ leaseToken, eventId, ...attempt }) => {
            void leaseToken;
            return { ...attempt, eventId: String(eventId) };
          }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async retry(id: bigint, actor: string) {
    return this.prisma.$transaction(async (tx) => {
      await assertTransactionPermission(tx, actor, 'integrations.manage');
      const changed = await tx.integrationEvent.updateMany({
        where: { id, status: { in: ['FAILED', 'SKIPPED'] } },
        data: {
          status: 'PENDING',
          retryAttempts: 0,
          manualRetryCount: { increment: 1 },
          processedAt: null,
          nextAttemptAt: new Date(),
          lastErrorCode: null,
          resultCode: null,
          resultSummary: Prisma.DbNull,
        },
      });
      if (!changed.count) {
        if (!(await tx.integrationEvent.findUnique({ where: { id } })))
          throw new NotFoundException();
        throw new ConflictException({
          code: 'INTEGRATION_RETRY_STATE',
          message: 'Повтор доступен для ошибочного или пропущенного события.',
        });
      }
      await this.audit.writeFieldChanges({
        tx,
        userId: actor,
        module: 'USERS',
        action: 'UPDATE',
        entityType: 'integration_event',
        entityStringId: String(id),
        fields: [{ fieldName: 'Ручной повтор', newValue: { id: String(id) } }],
      });
      return { scheduled: true };
    });
  }
}
