import { Prisma, PrismaClient } from '@prisma/client';
import type { DBAdapter } from '@better-auth/core/db/adapter';
import type { BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { validateRoleTransition } from './role-module-policy';
import { rethrowRoleApiError } from './role-api-error';

// Hooks run before the write and cannot hold its row lock. Role transitions
// therefore belong to this adapter, inside the transaction doing the UPDATE.
export function roleAwarePrismaAdapter(
  prisma: PrismaClient,
  activeModules: readonly string[],
) {
  return (options: BetterAuthOptions): DBAdapter => {
    function create(
      client: Prisma.TransactionClient,
      inTransaction: boolean,
    ): DBAdapter {
      const base = prismaAdapter(client, { provider: 'postgresql' })(options);
      const adapter: DBAdapter = {
        ...base,
        async update<T>(
          args: Parameters<DBAdapter['update']>[0],
        ): Promise<T | null> {
          if (
            args.model !== 'user' ||
            !Object.prototype.hasOwnProperty.call(args.update, 'role')
          )
            return base.update<T>(args);
          const [selector] = args.where;
          if (
            args.where.length !== 1 ||
            selector.field !== 'id' ||
            typeof selector.value !== 'string' ||
            (selector.operator && selector.operator !== 'eq')
          ) {
            throw new APIError('BAD_REQUEST', {
              code: 'INVALID_ROLE_TARGET',
              message: 'Изменение ролей требует идентификатор пользователя.',
            });
          }
          const persist = async (tx: Prisma.TransactionClient) => {
            const rows = await tx.$queryRaw<
              Array<{ role: string | null }>
            >`SELECT role FROM "user" WHERE id = ${selector.value} FOR UPDATE`;
            if (!rows.length) return null;
            let role: string;
            try {
              role = validateRoleTransition({
                currentRole: rows[0].role,
                requestedRole: args.update.role,
                activeModules,
              }).value;
            } catch (error) {
              rethrowRoleApiError(error);
            }
            return prismaAdapter(tx, { provider: 'postgresql' })(
              options,
            ).update<T>({ ...args, update: { ...args.update, role } });
          };
          return inTransaction ? persist(client) : prisma.$transaction(persist);
        },
        updateMany(args) {
          if (
            args.model === 'user' &&
            Object.prototype.hasOwnProperty.call(args.update, 'role')
          ) {
            throw new APIError('BAD_REQUEST', {
              code: 'ROLE_BULK_UPDATE_NOT_SUPPORTED',
              message: 'Изменяйте роли пользователей по одному.',
            });
          }
          return base.updateMany(args);
        },
        transaction: (operation) =>
          inTransaction
            ? operation(adapter)
            : prisma.$transaction((tx) => operation(create(tx, true))),
      };
      return adapter;
    }
    return create(prisma, false);
  };
}
