import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toAdminUserDto } from './users-admin.mapper';
import { throwNotFoundIfPrismaError } from './users-admin.errors';
import { parseBoolean, throwBadRequest } from './users-admin.validation';
import { UsersAdminAuditService } from './users-admin-audit.service';

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
        '\u041d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0441\u0432\u043e\u044e \u0443\u0447\u0451\u0442\u043d\u0443\u044e \u0437\u0430\u043f\u0438\u0441\u044c.',
      );
    }

    try {
      const currentUser = await this.prisma.user.findUniqueOrThrow({
        include: {
          employeeUser: {
            include: {
              employee: true,
            },
          },
        },
        where: { id: params.userId },
      });
      const user = await this.prisma.user.update({
        data: {
          banExpires: null,
          banReason: banned
            ? '\u041e\u0442\u043a\u043b\u044e\u0447\u0435\u043d\u043e \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u043e\u043c'
            : null,
          banned,
        },
        include: {
          employeeUser: {
            include: {
              employee: true,
            },
          },
        },
        where: { id: params.userId },
      });

      const userDto = toAdminUserDto(user);
      await this.audit.logUserStatusChanged({
        actorUserId: params.currentUserId,
        newUser: userDto,
        oldUser: toAdminUserDto(currentUser),
      });

      return userDto;
    } catch (error) {
      throwNotFoundIfPrismaError(error, 'USER_NOT_FOUND');
      throw error;
    }
  }
}
