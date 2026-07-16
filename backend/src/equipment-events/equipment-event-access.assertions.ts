import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventForbidden,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';

@Injectable()
export class EquipmentEventAccessAssertions {
  async getCurrentEmployeeId(
    tx: Prisma.TransactionClient,
    userId?: string | null,
  ) {
    if (!userId) {
      throwEquipmentEventForbidden(
        'SESSION_REQUIRED',
        'Сессия пользователя не найдена.',
      );
    }

    const employeeUser = await tx.employeeUser.findUnique({
      where: { userId },
      select: { employeeId: true },
    });

    if (!employeeUser) {
      throwEquipmentEventForbidden(
        'USER_EMPLOYEE_NOT_FOUND',
        'К учётной записи не привязан сотрудник.',
      );
    }

    return employeeUser.employeeId;
  }

  assertAssignedResponsible(
    responsibles: Array<{ userId: string }>,
    userId?: string | null,
  ) {
    if (!userId || !responsibles.some((item) => item.userId === userId)) {
      throwEquipmentEventForbidden(
        'EVENT_RESPONSIBLE_REQUIRED',
        'Только назначенный ответственный может выполнить это действие.',
      );
    }
  }

  async assertResponsibleUsersExist(
    tx: Prisma.TransactionClient,
    userIds: string[],
  ) {
    const uniqueUserIds = [...new Set(userIds)];

    if (uniqueUserIds.length === 0) {
      throwEquipmentEventBadRequest(
        'RESPONSIBLES_REQUIRED',
        'У события должен быть хотя бы один ответственный.',
      );
    }

    const users = await tx.user.findMany({
      where: {
        id: {
          in: uniqueUserIds,
        },
        employeeUser: {
          isNot: null,
        },
      },
      select: { banned: true, id: true },
    });

    if (users.length !== uniqueUserIds.length) {
      throwEquipmentEventNotFound(
        'RESPONSIBLE_NOT_FOUND',
        'Один или несколько ответственных пользователей не найдены.',
      );
    }

    if (users.some((user) => user.banned)) {
      throwEquipmentEventBadRequest(
        'RESPONSIBLE_USER_INACTIVE',
        'Один или несколько ответственных пользователей отключены.',
      );
    }
  }
}
