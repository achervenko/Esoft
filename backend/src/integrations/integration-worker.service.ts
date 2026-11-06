import { Prisma } from '@prisma/client';
import type { IntegrationSkipResult } from './integration.contracts';
import { Injectable, HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationRegistry } from './integration-registry';
import { IntegrationFailure } from './integration-errors';

const LEASE_MS = 60000,
  MAX_RETRIES = 8;
@Injectable()
export class IntegrationWorkerService {
  readonly owner = randomUUID();
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: IntegrationRegistry,
  ) {}
  async cleanupSkipped() {
    // Bounded batches keep ignored traffic from retaining an unbounded journal.
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: bigint }[]
      >`SELECT id FROM integration_events WHERE status='SKIPPED' AND processed_at < now()-interval '30 days' ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED`;
      if (!rows.length) return;
      const ids = rows.map((row) => row.id);
      await tx.integrationAttempt.deleteMany({
        where: { eventId: { in: ids } },
      });
      await tx.integrationEvent.deleteMany({
        where: { id: { in: ids }, status: 'SKIPPED' },
      });
    });
  }
  async drain(canContinue: () => boolean = () => true) {
    const now = new Date();
    const rows = await this.prisma.integrationEvent.findMany({
      where: {
        OR: [
          { status: 'PENDING', nextAttemptAt: { lte: now } },
          { status: 'PROCESSING', leaseUntil: { lte: now } },
        ],
        flow: { isActive: true, source: { isActive: true } },
      },
      orderBy: { id: 'asc' },
      take: 10,
      select: { id: true },
    });
    for (const row of rows) {
      if (!canContinue()) break;
      await this.process(row.id);
    }
  }
  async claim(id: bigint) {
    const token = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: bigint }[]>`
        WITH candidate AS (
          SELECT e.id FROM integration_events e JOIN integration_flows f ON f.source_id=e.source_id AND f.flow_code=e.flow_code
          JOIN integration_sources s ON s.id=f.source_id JOIN "user" u ON u.id=s.actor_user_id
          WHERE e.id=${id} AND f.is_active AND s.is_active AND NOT COALESCE(u.banned,false)
            AND ((e.status='PENDING' AND e.next_attempt_at<=now()) OR (e.status='PROCESSING' AND e.lease_until<=now()))
          FOR UPDATE OF e SKIP LOCKED
        ) UPDATE integration_events e SET status='PROCESSING',lease_owner=${this.owner},lease_token=${token}::uuid,
          lease_until=now()+${LEASE_MS}*interval '1 millisecond',started_at=now(),attempts=e.attempts+1,retry_attempts=e.retry_attempts+1
          FROM candidate c WHERE e.id=c.id RETURNING e.id`;
      if (!rows.length) return null;
      await tx.integrationAttempt.updateMany({
        where: { eventId: id, outcome: 'PROCESSING' },
        data: {
          outcome: 'LEASE_EXPIRED',
          finishedAt: new Date(),
          errorCode: 'LEASE_EXPIRED',
        },
      });
      const event = await tx.integrationEvent.findUniqueOrThrow({
        where: { id },
        include: { flow: { include: { source: true } } },
      });
      await tx.integrationAttempt.create({
        data: { eventId: id, leaseToken: token, startedAt: event.startedAt! },
      });
      return event;
    });
  }
  async renew(id: bigint, token: string) {
    const rows = await this.prisma.$queryRaw<
      { id: bigint }[]
    >`UPDATE integration_events SET lease_until=now()+${LEASE_MS}*interval '1 millisecond' WHERE id=${id} AND status='PROCESSING' AND lease_token=${token}::uuid AND lease_until>now() RETURNING id`;
    return rows.length === 1;
  }
  async finish(
    id: bigint,
    token: string,
    error?: { code: string; retryable: boolean },
    result?: IntegrationSkipResult,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { source_id: string; flow_code: string; retry_attempts: number }[]
      >`
        SELECT source_id,flow_code,retry_attempts FROM integration_events WHERE id=${id} AND status='PROCESSING' AND lease_token=${token}::uuid AND lease_until>now() FOR UPDATE`;
      if (!rows.length) return false;
      const row = rows[0],
        failed =
          !!error && (!error.retryable || row.retry_attempts >= MAX_RETRIES),
        now = new Date();
      const status = !error
        ? result
          ? 'SKIPPED'
          : 'PROCESSED'
        : failed
          ? 'FAILED'
          : 'PENDING';
      await tx.integrationEvent.update({
        where: { id },
        data: {
          status,
          resultCode: result?.code ?? null,
          resultSummary: result?.summary ?? Prisma.DbNull,
          leaseOwner: null,
          leaseToken: null,
          leaseUntil: null,
          processedAt: !error ? now : null,
          lastErrorCode: error?.code ?? null,
          nextAttemptAt: error
            ? new Date(
                now.getTime() +
                  Math.min(
                    300000,
                    5000 * 2 ** Math.min(row.retry_attempts - 1, 6),
                  ),
              )
            : now,
        },
      });
      await tx.integrationAttempt.update({
        where: { leaseToken: token },
        data: {
          finishedAt: now,
          outcome: !error
            ? result
              ? 'SKIPPED'
              : 'PROCESSED'
            : failed
              ? 'FAILED'
              : 'RETRY',
          errorCode: error?.code ?? null,
        },
      });
      await tx.integrationFlow.update({
        where: {
          sourceId_flowCode: {
            sourceId: row.source_id,
            flowCode: row.flow_code,
          },
        },
        data: !error
          ? { lastSuccessAt: now }
          : { lastErrorAt: now, lastErrorCode: error.code },
      });
      return true;
    });
  }
  private async unavailable(id: bigint, code: string) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.$queryRaw<{ lease_token: string | null }[]>`
        SELECT lease_token FROM integration_events WHERE id=${id} AND (status='PENDING' OR (status='PROCESSING' AND lease_until<=now())) FOR UPDATE`;
      if (!changed.length) return;
      if (changed[0].lease_token)
        await tx.integrationAttempt.updateMany({
          where: { leaseToken: changed[0].lease_token, outcome: 'PROCESSING' },
          data: {
            outcome: 'LEASE_EXPIRED',
            finishedAt: new Date(),
            errorCode: 'LEASE_EXPIRED',
          },
        });
      await tx.integrationEvent.update({
        where: { id },
        data: {
          status: 'PENDING',
          lastErrorCode: code,
          nextAttemptAt: new Date(Date.now() + 30000),
          leaseOwner: null,
          leaseToken: null,
          leaseUntil: null,
        },
      });
    });
  }
  async process(id: bigint) {
    const candidate = await this.prisma.integrationEvent.findUnique({
      where: { id },
      include: { flow: { include: { source: true } } },
    });
    if (!candidate) return;
    try {
      this.registry.validateFlow(
        candidate.flowCode,
        candidate.flow.source.systemType,
        candidate.flow.configVersion,
        candidate.flow.config,
      );
      this.registry.adapter(candidate.flow.source.systemType);
    } catch (error) {
      if (error instanceof IntegrationFailure && error.retryable) {
        await this.unavailable(id, error.code);
        return;
      }
      // Permanent preflight failures may be stale; validate the claimed snapshot below.
    }
    const event = await this.claim(id);
    if (!event) return;
    const token = event.leaseToken!;
    const abort = new AbortController();
    let lostLease = false;
    let renewal: Promise<void> | null = null;
    const heartbeat = setInterval(() => {
      if (renewal || lostLease) return;
      renewal = this.renew(id, token)
        .then((owned) => {
          if (!owned) {
            lostLease = true;
            abort.abort();
          }
        })
        .catch(() => {
          lostLease = true;
          abort.abort();
        })
        .finally(() => {
          renewal = null;
        });
    }, LEASE_MS / 4);
    heartbeat.unref();
    const waitForRenewal = () => renewal;
    try {
      const handler = this.registry.validateFlow(
        event.flowCode,
        event.flow.source.systemType,
        event.flow.configVersion,
        event.flow.config,
      );
      const adapter = this.registry.adapter(event.flow.source.systemType);
      const envelope = {
        eventId: event.eventId,
        objectId: event.objectId,
        type: event.type,
        version: event.version,
      };
      handler.validateEvent(envelope);
      const result = await handler.handle({
        sourceCode: event.flow.source.code,
        actorUserId: event.flow.source.actorUserId,
        event: envelope,
        configVersion: event.flow.configVersion,
        config: event.flow.config,
        client: {
          getJson: (path, signal) =>
            adapter
              .createHttpClient(event.flow.source)
              .getJson(
                path,
                signal ? AbortSignal.any([signal, abort.signal]) : abort.signal,
              ),
        },
      });
      await waitForRenewal();
      if (!lostLease) {
        if (result) await this.finish(id, token, undefined, result);
        else await this.finish(id, token);
      }
    } catch (error) {
      let code = 'INTEGRATION_HANDLER_FAILED',
        retryable = true;
      if (error instanceof IntegrationFailure) {
        code = /^[A-Z][A-Z0-9_]{0,99}$/.test(error.code) ? error.code : code;
        retryable = error.retryable;
      } else if (error instanceof HttpException) {
        retryable =
          error.getStatus() >= 500 || [408, 429].includes(error.getStatus());
        const response = error.getResponse();
        if (
          response &&
          typeof response === 'object' &&
          'code' in response &&
          typeof response.code === 'string' &&
          /^[A-Z][A-Z0-9_]{0,99}$/.test(response.code)
        )
          code = response.code;
      }
      await waitForRenewal();
      if (!lostLease) await this.finish(id, token, { code, retryable });
    } finally {
      clearInterval(heartbeat);
      await waitForRenewal();
    }
  }
}
