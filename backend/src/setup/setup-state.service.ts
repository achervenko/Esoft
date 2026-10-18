import { getBusinessTodayDate } from '../application/business-date';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hasAnyRoleSql } from '../auth/role-sql';
import { PrismaService } from '../prisma/prisma.service';
import {
  throwSetupAlreadyCompleted,
  throwSetupEmailAlreadyExists,
  throwSetupEmployeeInactive,
  throwSetupEmployeeNotFound,
  throwSetupUsernameAlreadyExists,
  throwSetupInvalidPayload,
} from './setup.errors';
import { lockSetupTransaction } from './setup-lock';
import {
  type ActiveAdminRow,
  type CreateInitialAdminInput,
  type SetupEmployeeDto,
  type SetupNewEmployee,
  type SetupEmployeeRow,
  formatSetupEmployeeFullName,
} from './setup.types';

type LockedSetupEmployeeRow = SetupEmployeeRow & {
  is_active: boolean;
};

@Injectable()
export class SetupStateService {
  private readonly logger = new Logger(SetupStateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async assertSetupRequired(tx: Prisma.TransactionClient = this.prisma) {
    if (await this.hasActiveAdministrator(tx)) {
      throwSetupAlreadyCompleted();
    }
  }

  async hasActiveAdministrator(tx: Prisma.TransactionClient = this.prisma) {
    const admins = await tx.$queryRaw<ActiveAdminRow[]>`
      SELECT "user".id
      FROM "user"
      JOIN employee_users employee_user
        ON employee_user.user_id = "user".id
      JOIN employees employee
        ON employee.id = employee_user.employee_id
      WHERE ${hasAnyRoleSql(Prisma.sql`"user".role`, ['admin'])}
        AND "user".banned IS NOT TRUE
        AND employee.is_active = true
        AND EXISTS (
          SELECT 1
          FROM account
          WHERE account."userId" = "user".id
            AND account."providerId" = 'credential'
            AND account.password IS NOT NULL
        )
      LIMIT 1
    `;

    const admin = admins[0];
    if (!admin) {
      await this.logInvalidAdministratorState(tx);
    }

    return Boolean(admin);
  }

  async listEmployees(): Promise<{ employees: SetupEmployeeDto[] }> {
    return this.prisma.$transaction(async (tx) => {
      await lockSetupTransaction(tx);

      await this.assertSetupRequired(tx);

      const employees = await tx.$queryRaw<SetupEmployeeRow[]>`
        SELECT employee.id, last_name, first_name, middle_name, position.name AS position
        FROM employees employee
        JOIN positions position ON position.id = employee.position_id
        WHERE employee.is_active = true
          AND employee.last_name <> ''
          AND employee.first_name <> ''
          AND position.name <> ''
        ORDER BY last_name ASC, first_name ASC, middle_name ASC NULLS LAST
      `;

      return {
        employees: employees.map((employee) => ({
          fullName: formatSetupEmployeeFullName(employee),
          id: employee.id,
          position: employee.position,
        })),
      };
    });
  }

  async assertEmailAndUsernameAvailable(
    input: CreateInitialAdminInput,
    tx: Prisma.TransactionClient,
  ) {
    const existingEmail = await tx.user.findUnique({
      select: { id: true },
      where: { email: input.email },
    });

    if (existingEmail) {
      throwSetupEmailAlreadyExists();
    }

    const existingUsername = await tx.user.findUnique({
      select: { id: true },
      where: { username: input.username },
    });

    if (existingUsername) {
      throwSetupUsernameAlreadyExists();
    }
  }

  async createSetupEmployee(
    input: SetupNewEmployee,
    tx: Prisma.TransactionClient,
  ): Promise<SetupEmployeeRow> {
    const positions = await tx.$queryRaw<Array<{ id: number; name: string }>>`
      SELECT id, name FROM positions WHERE lower(name) = lower('Админ') AND is_active = true FOR SHARE
    `;
    const position = positions[0];
    if (!position)
      throwSetupInvalidPayload('Активная должность Админ не найдена.');
    const employee = await tx.employee.create({
      data: {
        ...input,
        positionId: position.id,
        positionAssignedAt: getBusinessTodayDate(),
        isActive: true,
      },
    });
    return {
      id: employee.id,
      first_name: employee.firstName,
      last_name: employee.lastName,
      middle_name: employee.middleName,
      position: position.name,
    };
  }

  async lockSetupEmployee(employeeId: number, tx: Prisma.TransactionClient) {
    const employees = await tx.$queryRaw<LockedSetupEmployeeRow[]>`
      SELECT employee.id, last_name, first_name, middle_name, position.name AS position, employee.is_active
      FROM employees employee
      JOIN positions position ON position.id = employee.position_id
      WHERE employee.id = ${employeeId}
      FOR UPDATE OF employee
    `;
    const employee = employees[0];

    if (!employee) {
      throwSetupEmployeeNotFound();
    }

    if (!employee.is_active) {
      throwSetupEmployeeInactive();
    }

    return employee;
  }

  private async logInvalidAdministratorState(tx: Prisma.TransactionClient) {
    const invalidAdmins = await tx.$queryRaw<ActiveAdminRow[]>`
      SELECT "user".id
      FROM "user"
      JOIN employee_users employee_user
        ON employee_user.user_id = "user".id
      JOIN employees employee
        ON employee.id = employee_user.employee_id
      WHERE ${hasAnyRoleSql(Prisma.sql`"user".role`, ['admin'])}
        AND "user".banned IS NOT TRUE
        AND employee.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM account
          WHERE account."userId" = "user".id
            AND account."providerId" = 'credential'
            AND account.password IS NOT NULL
        )
      LIMIT 1
    `;

    if (invalidAdmins[0]) {
      this.logger.error(
        'Invalid initial setup state: administrator exists but authentication account is missing',
      );
    }
  }
}
