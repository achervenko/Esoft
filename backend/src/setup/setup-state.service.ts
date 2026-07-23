import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  throwSetupAlreadyCompleted,
  throwSetupEmailAlreadyExists,
  throwSetupEmployeeInactive,
  throwSetupEmployeeNotFound,
  throwSetupUsernameAlreadyExists,
} from './setup.errors';
import { lockSetupTransaction } from './setup-lock';
import {
  type ActiveAdminRow,
  type CreateInitialAdminInput,
  type SetupEmployeeDto,
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
      WHERE "user".role = 'admin'
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

    await this.logInvalidAdministratorState(tx);

    return Boolean(admins[0]);
  }

  async listEmployees(): Promise<{ employees: SetupEmployeeDto[] }> {
    return this.prisma.$transaction(async (tx) => {
      await lockSetupTransaction(tx);

      await this.assertSetupRequired(tx);

      const employees = await tx.$queryRaw<SetupEmployeeRow[]>`
        SELECT id, last_name, first_name, middle_name, position
        FROM employees employee
        WHERE employee.is_active = true
          AND employee.last_name <> ''
          AND employee.first_name <> ''
          AND employee.position <> ''
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

  async lockSetupEmployee(employeeId: number, tx: Prisma.TransactionClient) {
    const employees = await tx.$queryRaw<LockedSetupEmployeeRow[]>`
      SELECT id, last_name, first_name, middle_name, position, is_active
      FROM employees
      WHERE id = ${employeeId}
      FOR UPDATE
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
      WHERE "user".role = 'admin'
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
