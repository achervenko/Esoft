import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  throwIfUniqueConflict,
  throwNotFoundIfPrismaError,
} from './users-admin.errors';
import { getRoleLabel, toAdminUserDto } from './users-admin.mapper';
import {
  parseCreateUserPayload,
  parseUpdateUserPayload,
  throwBadRequest,
  UserRole,
  userRoles,
} from './users-admin.validation';
import { UsersAdminAssertionsService } from './users-admin-assertions.service';
import {
  createCredentialAccount,
  hashUserPassword,
} from './users-admin-credential-account';
import { UsersAdminAuditService } from './users-admin-audit.service';

type UserPayload = Parameters<typeof parseCreateUserPayload>[0];
const SERIALIZABLE_TRANSACTION_ATTEMPTS = 2;

@Injectable()
export class UserAccountsAdminService {
  constructor(
    private readonly assertions: UsersAdminAssertionsService,
    private readonly audit: UsersAdminAuditService,
    private readonly prisma: PrismaService,
  ) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        employeeUser: {
          include: {
            employee: true,
          },
        },
        photo: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return users.map(toAdminUserDto);
  }

  async createUser(payload: UserPayload, actorUserId?: string | null) {
    const data = parseCreateUserPayload(payload);
    await this.assertions.assertEmployeeExists(data.employeeId);
    const passwordHash = await hashUserPassword(data.password);
    const userId = randomUUID();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            displayUsername: data.username,
            email: data.email,
            emailVerified: false,
            id: userId,
            name: data.username,
            role: data.role,
            username: data.username,
          },
        });

        await createCredentialAccount(tx, createdUser.id, passwordHash);

        await tx.employeeUser.create({
          data: {
            employeeId: data.employeeId,
            userId: createdUser.id,
          },
        });

        const user = await tx.user.findUniqueOrThrow({
          include: {
            employeeUser: {
              include: {
                employee: true,
              },
            },
            photo: true,
          },
          where: { id: createdUser.id },
        });

        const userDto = toAdminUserDto(user);
        await this.audit.logUserCreated(userDto, actorUserId, tx);

        return userDto;
      });
    } catch (error) {
      throwIfUniqueConflict(error);
      throw error;
    }
  }

  async updateUser(
    userId: string,
    payload: UserPayload,
    actorUserId?: string | null,
  ) {
    const data = parseUpdateUserPayload(payload);
    await this.assertions.assertUserExists(userId);
    await this.assertions.assertEmployeeExists(data.employeeId);

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
          where: { id: userId },
        });

        await this.assertRoleChangeAllowed({
          actorUserId,
          currentRole: currentUser.role,
          newRole: data.role,
          tx,
          userId,
        });

        await tx.user.update({
          data: {
            displayUsername: data.username,
            email: data.email,
            name: data.username,
            role: data.role,
            username: data.username,
          },
          where: { id: userId },
        });

        await tx.employeeUser.upsert({
          create: {
            employeeId: data.employeeId,
            userId,
          },
          update: {
            employeeId: data.employeeId,
          },
          where: { userId },
        });

        const user = await tx.user.findUniqueOrThrow({
          include: {
            employeeUser: {
              include: {
                employee: true,
              },
            },
            photo: true,
          },
          where: { id: userId },
        });

        const userDto = toAdminUserDto(user);
        await this.audit.logUserUpdated({
          actorUserId,
          newUser: userDto,
          oldUser: toAdminUserDto(currentUser),
          tx,
        });

        return userDto;
      });
    } catch (error) {
      throwIfUniqueConflict(error);
      throwNotFoundIfPrismaError(error, 'USER_NOT_FOUND');
      throw error;
    }
  }

  getRoles() {
    return userRoles.map((role) => ({
      label: getRoleLabel(role),
      value: role,
    }));
  }

  private async assertRoleChangeAllowed(params: {
    actorUserId?: string | null;
    currentRole?: string | null;
    newRole: UserRole;
    tx: Prisma.TransactionClient;
    userId: string;
  }) {
    if (params.currentRole === params.newRole) {
      return;
    }

    if (params.actorUserId === params.userId) {
      throwBadRequest(
        'CANNOT_CHANGE_OWN_ROLE',
        'Нельзя изменить собственную роль.',
      );
    }

    if (params.currentRole !== 'admin' || params.newRole === 'admin') {
      return;
    }

    const remainingActiveAdminCount = await params.tx.user.count({
      where: {
        id: { not: params.userId },
        role: 'admin',
        OR: [{ banned: false }, { banned: null }],
      },
    });

    if (remainingActiveAdminCount === 0) {
      throwBadRequest(
        'LAST_ACTIVE_ADMIN_ROLE_REQUIRED',
        'Нельзя снять роль администратора с последней активной учётной записи администратора.',
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
