import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toEmployeeDto } from './users-admin.mapper';
import {
  parseEmployeePayload,
  throwBadRequest,
} from './users-admin.validation';
import {
  throwNotFoundIfPrismaError,
  throwUserAdminNotFound,
} from './users-admin.errors';
import { UsersAdminAuditService } from './users-admin-audit.service';

type EmployeePayload = Parameters<typeof parseEmployeePayload>[0];
type EmployeeWithUsage = Prisma.EmployeeGetPayload<{
  include: typeof employeeUsageInclude;
}>;

@Injectable()
export class EmployeesAdminService {
  private readonly logger = new Logger(EmployeesAdminService.name);

  constructor(
    private readonly audit: UsersAdminAuditService,
    private readonly prisma: PrismaService,
  ) {}

  async listEmployees() {
    const employees = await this.prisma.employee.findMany({
      include: {
        _count: {
          select: {
            employeeUsers: true,
            responsibleEquipment: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
        { middleName: 'asc' },
      ],
    });

    return employees.map(toEmployeeDto);
  }

  async createEmployee(payload: EmployeePayload, actorUserId?: string | null) {
    const employee = await this.prisma.employee.create({
      data: parseEmployeePayload(payload),
    });

    await this.logEmployeeCreatedBestEffort(employee, actorUserId);

    return toEmployeeDto(employee);
  }

  async updateEmployee(
    employeeId: number,
    payload: EmployeePayload,
    actorUserId?: string | null,
  ) {
    try {
      const currentEmployee = await this.prisma.employee.findUniqueOrThrow({
        where: { id: employeeId },
      });
      const employee = await this.prisma.employee.update({
        data: parseEmployeePayload(payload),
        include: {
          _count: {
            select: {
              employeeUsers: true,
              responsibleEquipment: true,
            },
          },
        },
        where: { id: employeeId },
      });

      await this.logEmployeeUpdatedBestEffort({
        actorUserId,
        newEmployee: employee,
        oldEmployee: currentEmployee,
      });

      return toEmployeeDto(employee);
    } catch (error) {
      throwNotFoundIfPrismaError(error, 'EMPLOYEE_NOT_FOUND');
      throw error;
    }
  }

  async deleteEmployee(employeeId: number, actorUserId?: string | null) {
    let employee: EmployeeWithUsage;

    try {
      employee = await this.prisma.$transaction(async (tx) => {
        const nextEmployee = await this.loadEmployeeWithUsage(tx, employeeId);

        if (!nextEmployee) {
          throwUserAdminNotFound('EMPLOYEE_NOT_FOUND');
        }

        this.assertEmployeeCanBeDeleted(nextEmployee);

        await tx.employee.delete({ where: { id: employeeId } });

        return nextEmployee;
      });
    } catch (error) {
      this.throwEmployeeInUseIfPrismaDeleteError(error);
      throwNotFoundIfPrismaError(error, 'EMPLOYEE_NOT_FOUND');
      throw error;
    }

    await this.logEmployeeDeletedBestEffort(employee, actorUserId);

    return { ok: true };
  }

  private loadEmployeeWithUsage(
    tx: Prisma.TransactionClient | PrismaService,
    employeeId: number,
  ) {
    return tx.employee.findUnique({
      include: employeeUsageInclude,
      where: { id: employeeId },
    });
  }

  private assertEmployeeCanBeDeleted(employee: EmployeeWithUsage) {
    if (
      employee._count.employeeUsers > 0 ||
      employee._count.responsibleEquipment > 0
    ) {
      throwBadRequest(
        'EMPLOYEE_IN_USE',
        'Сотрудник используется в системе. Удаление недоступно.',
      );
    }
  }

  private throwEmployeeInUseIfPrismaDeleteError(error: unknown): never | void {
    if (isPrismaForeignKeyError(error)) {
      throwBadRequest(
        'EMPLOYEE_IN_USE',
        'Сотрудник используется в системе. Удаление недоступно.',
      );
    }
  }

  private async logEmployeeCreatedBestEffort(
    employee: Parameters<UsersAdminAuditService['logEmployeeCreated']>[0],
    actorUserId?: string | null,
  ) {
    try {
      await this.audit.logEmployeeCreated(employee, actorUserId);
    } catch (error) {
      this.logAuditError(error);
    }
  }

  private async logEmployeeUpdatedBestEffort(
    params: Parameters<UsersAdminAuditService['logEmployeeUpdated']>[0],
  ) {
    try {
      await this.audit.logEmployeeUpdated(params);
    } catch (error) {
      this.logAuditError(error);
    }
  }

  private async logEmployeeDeletedBestEffort(
    employee: Parameters<UsersAdminAuditService['logEmployeeDeleted']>[0],
    actorUserId?: string | null,
  ) {
    try {
      await this.audit.logEmployeeDeleted(employee, actorUserId);
    } catch (error) {
      this.logAuditError(error);
    }
  }

  private logAuditError(error: unknown) {
    this.logger.error(
      'Failed to write employee audit log',
      error instanceof Error ? error.stack : String(error),
    );
  }
}

function isPrismaForeignKeyError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  );
}

const employeeUsageInclude = {
  _count: {
    select: {
      employeeUsers: true,
      responsibleEquipment: true,
    },
  },
} as const;
