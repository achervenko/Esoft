import { isDeepStrictEqual } from 'node:util';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { assertTransactionPermission } from '../auth/transaction-permission';
import { isPermission } from '../auth/permission-policy';
import { IntegrationRegistry } from './integration-registry';
import { object, text, invalid } from './integration.validation';

type FlowSource = { id: string; systemType: string; actorUserId: string };

@Injectable()
export class IntegrationFlowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: IntegrationRegistry,
    private readonly audit: AuditLogService,
  ) {}

  async createForSource(
    tx: Prisma.TransactionClient,
    source: FlowSource,
    requestedFlows: unknown,
  ) {
    if (!Array.isArray(requestedFlows) || requestedFlows.length > 100)
      invalid('Некорректные потоки источника.');
    const seen = new Set<string>();
    for (const requested of requestedFlows) {
      const f = object(requested, [
        'flowCode',
        'configVersion',
        'config',
        'isActive',
      ]);
      const flowCode = text(f.flowCode, 100);
      if (
        seen.has(flowCode) ||
        typeof f.configVersion !== 'number' ||
        !Number.isSafeInteger(f.configVersion) ||
        typeof f.isActive !== 'boolean'
      )
        invalid('Некорректные настройки потока.');
      seen.add(flowCode);
      this.registry.validateFlow(
        flowCode,
        source.systemType,
        f.configVersion,
        f.config,
      );
      if (
        !f.config ||
        typeof f.config !== 'object' ||
        Array.isArray(f.config) ||
        Buffer.byteLength(JSON.stringify(f.config)) > 65536
      )
        invalid('Некорректные настройки потока.');
      await tx.integrationFlow.create({
        data: {
          sourceId: source.id,
          flowCode,
          configVersion: f.configVersion,
          config: f.config,
          isActive: f.isActive,
        },
      });
    }
    await this.reconcileActorPermissions(tx, source);
  }
  async configureFlow(
    code: string,
    flowCode: string,
    value: unknown,
    actor: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await assertTransactionPermission(tx, actor, 'integrations.manage');
      await tx.$queryRaw`SELECT id FROM integration_sources WHERE code=${code} FOR UPDATE`;
      const source = await tx.integrationSource.findUnique({ where: { code } });
      if (!source) throw new NotFoundException();
      const flow = await this.configureForSource(
        tx,
        source,
        flowCode,
        value,
        actor,
      );
      await this.reconcileActorPermissions(tx, source);
      return flow;
    });
  }

  async updateForSource(
    tx: Prisma.TransactionClient,
    source: FlowSource,
    requestedFlows: unknown,
    actor: string,
  ) {
    if (!Array.isArray(requestedFlows) || requestedFlows.length > 100)
      invalid('Некорректные потоки источника.');
    const seen = new Set<string>();
    for (const requested of requestedFlows) {
      const f = object(requested, [
        'flowCode',
        'isActive',
        'configVersion',
        'config',
      ]);
      const flowCode = text(f.flowCode, 100);
      if (seen.has(flowCode)) invalid('Поток указан повторно.');
      seen.add(flowCode);
      await this.configureForSource(
        tx,
        source,
        flowCode,
        {
          isActive: f.isActive,
          configVersion: f.configVersion,
          config: f.config,
        },
        actor,
      );
    }
    // Keep flow rows and their event history; omitted flows stop participating.
    await tx.integrationFlow.updateMany({
      where: {
        sourceId: source.id,
        flowCode: { notIn: [...seen] },
        isActive: true,
      },
      data: { isActive: false },
    });
    await this.reconcileActorPermissions(tx, source);
  }

  // The caller holds the source row lock in this transaction.
  private async configureForSource(
    tx: Prisma.TransactionClient,
    source: FlowSource,
    flowCode: string,
    value: unknown,
    actor: string,
  ) {
    const b = object(value, ['isActive', 'configVersion', 'config']);
    if (
      typeof b.isActive !== 'boolean' ||
      typeof b.configVersion !== 'number' ||
      !Number.isSafeInteger(b.configVersion)
    )
      invalid('Некорректные настройки потока.');
    if (
      !b.config ||
      typeof b.config !== 'object' ||
      Array.isArray(b.config) ||
      Buffer.byteLength(JSON.stringify(b.config)) > 65536
    )
      invalid('Ожидается объект настроек до 64 KiB.');
    if (!this.registry.findFlow(flowCode)) {
      const previous = await tx.integrationFlow.findUnique({
        where: { sourceId_flowCode: { sourceId: source.id, flowCode } },
      });
      if (
        previous &&
        previous.isActive === b.isActive &&
        previous.configVersion === b.configVersion &&
        isDeepStrictEqual(previous.config, b.config)
      )
        return previous;
    }
    this.registry.validateFlow(
      flowCode,
      source.systemType,
      b.configVersion,
      b.config,
    );
    const data = {
      isActive: b.isActive,
      configVersion: b.configVersion,
      config: b.config as Prisma.InputJsonObject,
    };
    const flow = await tx.integrationFlow.upsert({
      where: { sourceId_flowCode: { sourceId: source.id, flowCode } },
      create: { sourceId: source.id, flowCode, ...data },
      update: data,
    });
    await this.audit.writeFieldChanges({
      tx,
      userId: actor,
      module: 'USERS',
      action: 'UPDATE',
      entityType: 'integration_flow',
      entityStringId: source.id + ':' + flowCode,
      fields: [
        {
          fieldName: 'Настройка потока',
          newValue: {
            flowCode,
            isActive: flow.isActive,
            configVersion: flow.configVersion,
          },
        },
      ],
    });
    return flow;
  }
  private async reconcileActorPermissions(
    tx: Prisma.TransactionClient,
    source: FlowSource,
  ) {
    const flows = await tx.integrationFlow.findMany({
      where: { sourceId: source.id, isActive: true },
      select: { flowCode: true },
    });
    const required = new Set<string>();
    let unresolved = false;
    for (const flow of flows) {
      const handler = this.registry.findFlow(flow.flowCode);
      if (!handler) {
        unresolved = true;
        continue;
      }
      for (const permission of handler.actorPermissions ?? []) {
        if (!isPermission(permission))
          invalid('Обработчик запросил неизвестное разрешение.');
        required.add(permission);
      }
    }
    for (const permission of required) {
      await tx.systemActorPermission.upsert({
        where: {
          sourceId_actorUserId_permission: {
            sourceId: source.id,
            actorUserId: source.actorUserId,
            permission,
          },
        },
        create: {
          sourceId: source.id,
          actorUserId: source.actorUserId,
          permission,
        },
        update: {},
      });
    }
    // An unavailable active handler may still require any of the existing grants.
    if (!unresolved)
      await tx.systemActorPermission.deleteMany({
        where: {
          sourceId: source.id,
          actorUserId: source.actorUserId,
          permission: { notIn: [...required] },
        },
      });
  }
}
