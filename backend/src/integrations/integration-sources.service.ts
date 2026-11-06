import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { assertTransactionPermission } from '../auth/transaction-permission';
import { ensureIntegrationActor } from '../auth/system-actors';
import { IntegrationFlowsService } from './integration-flows.service';
import { IntegrationRegistry } from './integration-registry';
import { encryptSourceAuthorization } from './integration-credentials';
import { object, text, invalid } from './integration.validation';
const publicFields = {
  id: true,
  code: true,
  name: true,
  systemType: true,
  baseUrl: true,
  actorUserId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  flows: true,
} as const;
@Injectable()
export class IntegrationSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: IntegrationRegistry,
    private readonly audit: AuditLogService,
    private readonly flows: IntegrationFlowsService,
  ) {}
  async list(actor: string) {
    return this.prisma.$transaction(async (tx) => {
      await assertTransactionPermission(tx, actor, 'integrations.manage');
      return tx.integrationSource.findMany({
        select: publicFields,
        orderBy: { createdAt: 'desc' },
      });
    });
  }
  async create(value: unknown, actor: string) {
    const b = object(value, [
      'name',
      'systemType',
      'baseUrl',
      'authorization',
      'isActive',
      'flows',
    ]);
    const name = text(b.name, 200),
      systemType = text(b.systemType, 50),
      baseUrl = text(b.baseUrl, 2000),
      authorization = text(b.authorization, 2000);
    if (/[\r\n]/.test(authorization)) invalid('Некорректная авторизация.');
    if (b.isActive !== undefined && typeof b.isActive !== 'boolean')
      invalid('Некорректная активность.');
    this.registry.adapter(systemType).validateSourceConfig({ baseUrl });
    const id = randomUUID(),
      code = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      await assertTransactionPermission(tx, actor, 'integrations.manage');
      const actorUserId = await ensureIntegrationActor(tx, id, name);
      await tx.integrationSource.create({
        data: {
          id,
          code,
          name,
          isActive: b.isActive !== false,
          systemType,
          baseUrl: baseUrl.replace(/\/+$/, '') + '/',
          authorizationEncrypted: encryptSourceAuthorization(authorization),
          actorUserId,
        },
        select: publicFields,
      });
      const requestedFlows = b.flows ?? [];
      await this.flows.createForSource(
        tx,
        { id, systemType, actorUserId },
        requestedFlows,
      );
      await this.audit.writeFieldChanges({
        tx,
        userId: actor,
        module: 'USERS',
        action: 'CREATE',
        entityType: 'integration_source',
        entityStringId: id,
        fields: [
          {
            fieldName: 'Источник интеграции',
            newValue: { id, code, name, systemType },
          },
        ],
      });
      return tx.integrationSource.findUniqueOrThrow({
        where: { id },
        select: publicFields,
      });
    });
  }
  async update(code: string, value: unknown, actor: string) {
    const b = object(value, [
      'name',
      'baseUrl',
      'authorization',
      'isActive',
      'flows',
    ]);
    if (b.isActive !== undefined && typeof b.isActive !== 'boolean')
      invalid('Некорректная активность.');
    return this.prisma.$transaction(async (tx) => {
      await assertTransactionPermission(tx, actor, 'integrations.manage');
      await tx.$queryRaw`SELECT id FROM integration_sources WHERE code=${code} FOR UPDATE`;
      const previous = await tx.integrationSource.findUnique({
        where: { code },
      });
      if (!previous) throw new NotFoundException();
      const baseUrl =
        b.baseUrl === undefined ? previous.baseUrl : text(b.baseUrl, 2000);
      this.registry
        .adapter(previous.systemType)
        .validateSourceConfig({ baseUrl });
      const authorization =
        b.authorization === undefined || b.authorization === ''
          ? undefined
          : text(b.authorization, 2000);
      if (authorization && /[\r\n]/.test(authorization))
        invalid('Некорректная авторизация.');
      const source = await tx.integrationSource.update({
        where: { code },
        data: {
          name: b.name === undefined ? undefined : text(b.name, 200),
          baseUrl: baseUrl.replace(/\/+$/, '') + '/',
          authorizationEncrypted: authorization
            ? encryptSourceAuthorization(authorization)
            : undefined,
          isActive: b.isActive as boolean | undefined,
        },
        select: publicFields,
      });
      if (b.flows !== undefined)
        await this.flows.updateForSource(tx, source, b.flows, actor);
      await this.audit.writeFieldChanges({
        tx,
        userId: actor,
        module: 'USERS',
        action: 'UPDATE',
        entityType: 'integration_source',
        entityStringId: source.id,
        fields: [
          {
            fieldName: 'Настройка источника',
            newValue: {
              name: source.name,
              baseUrl: source.baseUrl,
              isActive: source.isActive,
              credentialReplaced: !!authorization,
            },
          },
        ],
      });
      return b.flows !== undefined
        ? tx.integrationSource.findUniqueOrThrow({
            where: { code },
            select: publicFields,
          })
        : source;
    });
  }
  configureFlow(code: string, flowCode: string, value: unknown, actor: string) {
    return this.flows.configureFlow(code, flowCode, value, actor);
  }
}
