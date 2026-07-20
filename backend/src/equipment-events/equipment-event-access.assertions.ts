import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventForbidden,
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

    const employeeUsers = await tx.$queryRaw<
      Array<{
        employee_id: number;
        employee_is_active: boolean;
        user_is_banned: boolean | null;
      }>
    >`
      SELECT
        eu.employee_id,
        e.is_active AS employee_is_active,
        u.banned AS user_is_banned
      FROM employee_users eu
      JOIN employees e ON e.id = eu.employee_id
      JOIN "user" u ON u.id = eu.user_id
      WHERE eu.user_id = ${userId}
      FOR SHARE OF eu, e, u
    `;
    const employeeUser = employeeUsers[0];

    if (!employeeUser) {
      throwEquipmentEventForbidden(
        'USER_EMPLOYEE_NOT_FOUND',
        'К учётной записи не привязан сотрудник.',
      );
    }

    if (employeeUser.user_is_banned) {
      throwEquipmentEventForbidden(
        'USER_INACTIVE',
        'Учётная запись отключена.',
      );
    }

    if (!employeeUser.employee_is_active) {
      throwEquipmentEventForbidden(
        'USER_EMPLOYEE_INACTIVE',
        'Привязанный сотрудник отключён.',
      );
    }

    return employeeUser.employee_id;
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

    const users = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT u.id
      FROM "user" u
      JOIN employee_users eu ON eu.user_id = u.id
      JOIN employees e ON e.id = eu.employee_id
      WHERE u.id IN (${Prisma.join(uniqueUserIds)})
        AND COALESCE(u.banned, false) = false
        AND e.is_active = true
      FOR SHARE OF u, eu, e
    `;

    if (users.length !== uniqueUserIds.length) {
      throwEquipmentEventBadRequest(
        'RESPONSIBLE_USER_INACTIVE',
        'Один или несколько ответственных не найдены или отключены.',
      );
    }
  }
}
