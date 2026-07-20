import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toEmployeeDto } from './users-admin.mapper';
import { parseBoolean, parseEmployeePayload } from './users-admin.validation';
import { throwNotFoundIfPrismaError } from './users-admin.errors';
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
    const employee = await this.prisma.$transaction(async (tx) => {
      const nextEmployee = await tx.employee.create({
        data: parseEmployeePayload(payload),
      });

      await this.audit.logEmployeeCreated(nextEmployee, actorUserId, tx);

      return nextEmployee;
    });

    return toEmployeeDto(employee);
  }

  async updateEmployee(
    employeeId: number,
    payload: EmployeePayload,
    actorUserId?: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentEmployee = await tx.employee.findUniqueOrThrow({
          where: { id: employeeId },
        });
        const employee = await tx.employee.update({
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
          tx,
        });

        return toEmployeeDto(employee);
      });
    } catch (error) {
      throwNotFoundIfPrismaError(error, 'EMPLOYEE_NOT_FOUND');
      throw error;
    }
  }

  async setEmployeeStatus(params: {
    actorUserId?: string | null;
    employeeId: number;
    isActive?: unknown;
  }) {
    const isActive = parseBoolean(params.isActive);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentEmployee = await tx.employee.findUniqueOrThrow({
          where: { id: params.employeeId },
        });

        if (currentEmployee.isActive === isActive) {
          return toEmployeeDto(currentEmployee);
        }

        const employee = await tx.employee.update({
          data: { isActive },
          include: {
            _count: {
              select: {
                employeeUsers: true,
                responsibleEquipment: true,
              },
            },
          },
          where: { id: params.employeeId },
        });

        const employeeDto = toEmployeeDto(employee);
        await this.audit.logEmployeeStatusChanged({
          actorUserId: params.actorUserId,
          newEmployee: employeeDto,
          oldEmployee: toEmployeeDto(currentEmployee),
          tx,
        });

        return employeeDto;
      });
    } catch (error) {
      throwNotFoundIfPrismaError(error, 'EMPLOYEE_NOT_FOUND');
      throw error;
    }
  }
}
