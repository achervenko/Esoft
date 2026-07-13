import { Injectable } from '@nestjs/common';
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
  userRoles,
} from './users-admin.validation';
import { UsersAdminAssertionsService } from './users-admin-assertions.service';
import {
  createCredentialAccount,
  hashUserPassword,
} from './users-admin-credential-account';
import { UsersAdminAuditService } from './users-admin-audit.service';

type UserPayload = Parameters<typeof parseCreateUserPayload>[0];

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
      const user = await this.prisma.$transaction(async (tx) => {
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

        return tx.user.findUniqueOrThrow({
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
      });

      const userDto = toAdminUserDto(user);
      await this.audit.logUserCreated(userDto, actorUserId);

      return userDto;
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
      const currentUser = await this.prisma.user.findUniqueOrThrow({
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
      const user = await this.prisma.$transaction(async (tx) => {
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

        return tx.user.findUniqueOrThrow({
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
      });

      const userDto = toAdminUserDto(user);
      await this.audit.logUserUpdated({
        actorUserId,
        newUser: userDto,
        oldUser: toAdminUserDto(currentUser),
      });

      return userDto;
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
}
