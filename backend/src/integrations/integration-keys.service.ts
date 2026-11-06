import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MachineApiKeysService } from '../auth/machine-api-keys.service';
import { AuditLogService } from '../audit/audit-log.service';
import { assertTransactionPermission } from '../auth/transaction-permission';
import { IntegrationRegistry } from './integration-registry';
import { isPermission } from '../auth/permission-policy';
import { object, text, invalid } from './integration.validation';
@Injectable()
export class IntegrationKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: MachineApiKeysService,
    private readonly registry: IntegrationRegistry,
    private readonly audit: AuditLogService,
  ) {}
  private async source(
    tx: Prisma.TransactionClient,
    code: string,
    actor: string,
  ) {
    await assertTransactionPermission(tx, actor, 'integrations.manage');
    await tx.$queryRaw`SELECT id FROM integration_sources WHERE code=${code} FOR SHARE`;
    const source = await tx.integrationSource.findUnique({
      where: { code },
      include: { flows: true, actor: { select: { banned: true } } },
    });
    if (!source) throw new NotFoundException();
    return source;
  }
  async create(code: string, value: unknown, actor: string) {
    const b = object(value, ['name', 'expiresIn', 'flows']),
      name = text(b.name, 100),
      expiresIn = b.expiresIn ?? 365 * 86400;
    if (
      typeof expiresIn !== 'number' ||
      !Number.isSafeInteger(expiresIn) ||
      expiresIn < 86400 ||
      expiresIn > 365 * 86400
    )
      invalid('Срок ключа от 1 до 365 дней, в секундах.');
    if (
      !b.flows ||
      typeof b.flows !== 'object' ||
      Array.isArray(b.flows) ||
      !Object.keys(b.flows).length
    )
      invalid('Выберите потоки ключа.');
    const permissions: Record<string, string[]> = {};
    for (const [flow, actions] of Object.entries(b.flows)) {
      if (!Array.isArray(actions) || actions.some((v) => typeof v !== 'string'))
        invalid('Некорректные действия ключа.');
      this.registry.validateCapabilities(flow, actions as string[]);
      permissions[flow] = actions as string[];
    }
    return this.prisma.$transaction(async (tx) => {
      const source = await this.source(tx, code, actor);
      if (source.actor.banned)
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Недостаточно прав.',
        });
      if (!source.isActive) invalid('Источник отключён.');
      if (
        Object.keys(permissions).some(
          (flow) =>
            !source.flows.some((f) => f.flowCode === flow && f.isActive),
        )
      )
        invalid('Поток не подключён или отключён.');
      for (const flowCode of Object.keys(permissions))
        for (const permission of this.registry.flow(flowCode)
          .actorPermissions ?? []) {
          if (!isPermission(permission))
            invalid('Неизвестное разрешение обработчика.');
          await assertTransactionPermission(
            tx,
            source.actorUserId,
            permission,
            source.code,
          );
        }
      const key = await this.keys.create(
        source.actorUserId,
        name,
        expiresIn,
        {
          purpose: 'integration',
          sourceId: source.id,
          sourceCode: source.code,
        },
        permissions,
        tx,
      );
      await this.audit.writeFieldChanges({
        tx,
        userId: actor,
        module: 'USERS',
        action: 'CREATE',
        entityType: 'integration_key',
        entityStringId: key.id,
        fields: [
          {
            fieldName: 'Ключ интеграции',
            newValue: {
              sourceId: source.id,
              name,
              expiresIn,
              flows: permissions,
            },
          },
        ],
      });
      return key;
    });
  }
  async list(code: string, actor: string) {
    const source = await this.prisma.$transaction((tx) =>
      this.source(tx, code, actor),
    );
    return this.keys.list(source.actorUserId, {
      purpose: 'integration',
      sourceId: source.id,
    });
  }

  async revoke(code: string, id: string, actor: string) {
    return this.prisma.$transaction(async (tx) => {
      const source = await this.source(tx, code, actor);
      await this.keys.revokeInTransaction(tx, id, source.actorUserId, {
        purpose: 'integration',
        sourceId: source.id,
      });
      await this.audit.writeFieldChanges({
        tx,
        userId: actor,
        module: 'USERS',
        action: 'UPDATE',
        entityType: 'integration_key',
        entityStringId: id,
        fields: [
          { fieldName: 'Ключ отозван', newValue: { sourceId: source.id } },
        ],
      });
      return { id, enabled: false };
    });
  }
}
