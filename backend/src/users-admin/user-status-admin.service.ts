import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toAdminUserDto } from './users-admin.mapper';
import { throwNotFoundIfPrismaError } from './users-admin.errors';
import { parseBoolean, throwBadRequest } from './users-admin.validation';
import { UsersAdminAuditService } from './users-admin-audit.service';

const SERIALIZABLE_TRANSACTION_ATTEMPTS = 2;

@Injectable()
export class UserStatusAdminService {
  constructor(
    private readonly audit: UsersAdminAuditService,
    private readonly prisma: PrismaService,
  ) {}

  async setUserStatus(params: {
    banned?: unknown;
    currentUserId: string;
    userId: string;
  }) {
    const banned = parseBoolean(params.banned);

    if (banned && params.currentUserId === params.userId) {
      throwBadRequest(
        'CANNOT_DISABLE_SELF',
        'Нельзя отключить свою учётную запись.',
      );
    }

    try {
      return await this.runSerializableTransaction(async (tx) => {
        const currentUser = await tx.user.findUniqueOrThrow({
          include: {
            employeeUser: {
              include: {
                employee: true,
              },
            },
            photo: true,
          },
          where: { id: params.userId },
        });

        if (Boolean(currentUser.banned) === banned) {
          return toAdminUserDto(currentUser);
        }

        if (banned && currentUser.role === 'admin') {
          await this.assertAnotherActiveAdminExists(tx, params.userId);
        }

        const user = await tx.user.update({
          data: {
            banExpires: null,
            banReason: banned ? 'Отключено администратором' : null,
            banned,
          },
          include: {
            employeeUser: {
              include: {
                employee: true,
              },
            },
            photo: true,
          },
          where: { id: params.userId },
        });

        if (banned) {
          await tx.session.deleteMany({
            where: { userId: params.userId },
          });
        }

        const userDto = toAdminUserDto(user);
        await this.audit.logUserStatusChanged({
          actorUserId: params.currentUserId,
          newUser: userDto,
          oldUser: toAdminUserDto(currentUser),
          tx,
        });

        return userDto;
      });
    } catch (error) {
      throwNotFoundIfPrismaError(error, 'USER_NOT_FOUND');
      throw error;
    }
  }

  private async assertAnotherActiveAdminExists(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    const remainingActiveAdminCount = await tx.user.count({
      where: {
        id: { not: userId },
        role: 'admin',
        OR: [{ banned: false }, { banned: null }],
      },
    });

    if (remainingActiveAdminCount === 0) {
      throwBadRequest(
        'LAST_ACTIVE_ADMIN_STATUS_REQUIRED',
        'Нельзя отключить последнюю активную учётную запись администратора.',
      );
    }
  }

  private async runSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    for (
      let attempt = 1;
      attempt <= SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          attempt === SERIALIZABLE_TRANSACTION_ATTEMPTS ||
          !this.isTransactionConflict(error)
        ) {
          throw error;
        }
      }
    }

    throw new Error('Serializable transaction failed');
  }

  private isTransactionConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
