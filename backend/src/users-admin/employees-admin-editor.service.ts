import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  toEmployeeDto,
  employeeAdminInclude,
  employeePositionsInclude,
} from './users-admin.mapper';
import { throwNotFoundIfPrismaError } from './users-admin.errors';
import { UsersAdminAuditService } from './users-admin-audit.service';
import { parseEmployeePayload } from './users-admin.validation';
import { getBusinessTodayDate } from '../application/business-date';
import { EmployeePositionAssignmentsService } from './employee-position-assignments.service';
type EmployeePayload = Parameters<typeof parseEmployeePayload>[0];
@Injectable()
export class EmployeesAdminEditorService {
  constructor(
    private readonly audit: UsersAdminAuditService,
    private readonly prisma: PrismaService,
    private readonly assignments: EmployeePositionAssignmentsService,
  ) {}
  async createEmployee(payload: EmployeePayload, actorUserId?: string | null) {
    const employee = await this.prisma.$transaction(async (tx) => {
      const { additionalPositionIds, ...data } = parseEmployeePayload(payload);
      await this.assignments.assertPosition(tx, data.positionId);
      const additionalPositions = await this.assignments.create(
        tx,
        additionalPositionIds ?? [],
      );
      const nextEmployee = await tx.employee.create({
        include: employeePositionsInclude,
        data: {
          ...data,
          positionAssignedAt: getBusinessTodayDate(),
          additionalPositions,
        },
      });

      await this.audit.logEmployeeCreated(
        toEmployeeDto(nextEmployee),
        actorUserId,
        tx,
      );

      return nextEmployee;
    });

    return toEmployeeDto(employee, actorUserId);
  }

  async updateEmployee(
    employeeId: number,
    payload: EmployeePayload,
    actorUserId?: string | null,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM employees WHERE id = ${employeeId} FOR UPDATE`;
        const currentEmployee = await tx.employee.findUniqueOrThrow({
          include: employeePositionsInclude,
          where: { id: employeeId },
        });
        const { additionalPositionIds, ...data } =
          parseEmployeePayload(payload);
        await this.assignments.assertPosition(
          tx,
          data.positionId,
          currentEmployee.positionId,
        );
        const assignments = await this.assignments.update(
          tx,
          data.positionId,
          additionalPositionIds,
          currentEmployee,
        );
        const employee = await tx.employee.update({
          data: {
            ...data,
            ...assignments,
          },
          include: employeeAdminInclude,
          where: { id: employeeId },
        });

        await this.audit.logEmployeeUpdated({
          actorUserId,
          newEmployee: toEmployeeDto(employee),
          oldEmployee: toEmployeeDto(currentEmployee),
          tx,
        });

        return toEmployeeDto(employee, actorUserId);
      });
    } catch (error) {
      throwNotFoundIfPrismaError(error, 'EMPLOYEE_NOT_FOUND');
      throw error;
    }
  }
}
