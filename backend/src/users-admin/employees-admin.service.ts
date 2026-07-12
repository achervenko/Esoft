import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toEmployeeDto } from './users-admin.mapper';
import { parseEmployeePayload, throwBadRequest } from './users-admin.validation';
import { throwNotFoundIfPrismaError, throwUserAdminNotFound } from './users-admin.errors';
import { UsersAdminAuditService } from './users-admin-audit.service';

type EmployeePayload = Parameters<typeof parseEmployeePayload>[0];

@Injectable()
export class EmployeesAdminService {
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

    await this.audit.logEmployeeCreated(employee, actorUserId);

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

      await this.audit.logEmployeeUpdated({
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
    const employee = await this.prisma.employee.findUnique({
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

    if (!employee) {
      throwUserAdminNotFound('EMPLOYEE_NOT_FOUND');
    }

    if (
      employee._count.employeeUsers > 0 ||
      employee._count.responsibleEquipment > 0
    ) {
      throwBadRequest(
        'EMPLOYEE_IN_USE',
        '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f \u0432 \u0441\u0438\u0441\u0442\u0435\u043c\u0435. \u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e.',
      );
    }

    await this.prisma.employee.delete({ where: { id: employeeId } });
    await this.audit.logEmployeeDeleted(employee, actorUserId);

    return { ok: true };
  }
}
