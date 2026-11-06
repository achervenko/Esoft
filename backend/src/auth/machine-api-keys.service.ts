import {
  HttpException,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import type { Auth } from './auth.config';
import {
  MACHINE_KEY_CONFIG,
  type MachineKeyPermissions,
  type MachineKeyScope,
} from './machine-api-key.contract';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class MachineApiKeysService {
  constructor(
    private readonly auth: AuthService<Auth>,
    private readonly prisma: PrismaService,
  ) {}

  async verifyBearer(
    authorization: string | undefined,
    permissions: MachineKeyPermissions,
  ) {
    const token = authorization?.match(/^Bearer ([^\s]{1,1024})$/i)?.[1];
    if (!token)
      throw new UnauthorizedException({
        code: 'MACHINE_KEY_INVALID',
        message: 'Неверный API-ключ.',
      });
    const result = await this.auth.api.verifyApiKey({
      body: {
        configId: MACHINE_KEY_CONFIG,
        key: token,
        permissions,
      },
    });
    if (!result.valid || !result.key) {
      const message: unknown = result.error?.message;
      // Better Auth 1.6 returns RawError as message for internal failures, text for invalid keys.
      if (
        result.error?.code === 'INVALID_API_KEY' &&
        message &&
        typeof message === 'object' &&
        'code' in message &&
        message.code === 'INVALID_API_KEY'
      )
        throw new ServiceUnavailableException({
          code: 'MACHINE_KEY_VERIFICATION_UNAVAILABLE',
          message: 'Проверка API-ключа временно недоступна.',
        });
      if (result.error?.code === 'RATE_LIMITED')
        throw new HttpException(
          {
            code: 'MACHINE_KEY_RATE_LIMITED',
            message: 'Превышена частота запросов.',
          },
          429,
        );
      throw new UnauthorizedException({
        code: 'MACHINE_KEY_INVALID',
        message: 'Неверный API-ключ.',
      });
    }
    return result.key;
  }

  async create(
    userId: string,
    name: string,
    expiresIn: number,
    metadata: Record<string, string>,
    permissions: MachineKeyPermissions,
    tx?: Prisma.TransactionClient,
  ) {
    let api = this.auth.api;
    if (tx) {
      if ('$connect' in tx)
        throw new Error(
          'Expected a transaction client for machine key creation.',
        );
      const [{ betterAuth }, { prismaAdapter }] = await Promise.all([
        import('better-auth'),
        import('better-auth/adapters/prisma'),
      ]);
      // Keep plugin configuration, but bind every database operation to the caller's transaction.
      api = betterAuth({
        ...this.auth.instance.options,
        database: prismaAdapter(tx, { provider: 'postgresql' }),
      }).api;
    }
    const result = await api.createApiKey({
      body: {
        configId: MACHINE_KEY_CONFIG,
        userId,
        name,
        expiresIn,
        metadata,
        permissions,
      },
    });
    return {
      id: result.id,
      key: result.key,
      name: result.name,
      expiresAt: result.expiresAt,
    };
  }

  private assertScope(scope: MachineKeyScope) {
    if (
      !scope ||
      typeof scope.purpose !== 'string' ||
      !scope.purpose.trim() ||
      typeof scope.sourceId !== 'string' ||
      !scope.sourceId.trim()
    )
      throw new UnauthorizedException({
        code: 'MACHINE_KEY_INVALID',
        message: 'Не задан источник API-ключа.',
      });
  }

  private matchesScope(value: string | null, scope: MachineKeyScope) {
    let metadata: unknown;
    try {
      metadata = value ? JSON.parse(value) : null;
    } catch {
      return false;
    }
    return (
      !!metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata) &&
      'purpose' in metadata &&
      metadata.purpose === scope.purpose &&
      'sourceId' in metadata &&
      metadata.sourceId === scope.sourceId
    );
  }

  async list(userId: string, scope: MachineKeyScope) {
    this.assertScope(scope);
    const rows = await this.prisma.apiKey.findMany({
      where: { referenceId: userId, configId: MACHINE_KEY_CONFIG },
      select: {
        id: true,
        name: true,
        enabled: true,
        expiresAt: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows
      .filter((row) => this.matchesScope(row.metadata, scope))
      .map((row) => ({
        id: row.id,
        name: row.name,
        enabled: row.enabled,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      }));
  }

  async revokeInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    userId: string,
    expectedMetadata: MachineKeyScope,
  ) {
    this.assertScope(expectedMetadata);
    const key = await tx.apiKey.findFirst({
      where: { id, referenceId: userId, configId: MACHINE_KEY_CONFIG },
      select: { metadata: true },
    });
    if (!this.matchesScope(key?.metadata ?? null, expectedMetadata))
      throw new UnauthorizedException({
        code: 'MACHINE_KEY_INVALID',
        message: 'Ключ не принадлежит источнику.',
      });
    await tx.apiKey.update({ where: { id }, data: { enabled: false } });
  }
}
