import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toEmployeeDto, employeeAdminInclude } from './users-admin.mapper';
import { throwNotFoundIfPrismaError } from './users-admin.errors';
import { UsersAdminAuditService } from './users-admin-audit.service';
import { parseBoolean, throwBadRequest } from './users-admin.validation';
@Injectable()
export class EmployeesAdminStatusService {
  constructor(
    private readonly audit: UsersAdminAuditService,
    private readonly prisma: PrismaService,
  ) {}
  async setEmployeeStatus(params: {
    actorUserId?: string | null;
    employeeId: number;
    isActive?: unknown;
  }) {
    const isActive = parseBoolean(params.isActive);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM employees WHERE id = ${params.employeeId} FOR UPDATE`;
        const currentEmployee = await tx.employee.findUniqueOrThrow({
          include: employeeAdminInclude,
          where: { id: params.employeeId },
        });

        if (
          !isActive &&
          currentEmployee.employeeUsers.some(
            (employeeUser) => employeeUser.user.id === params.actorUserId,
          )
        ) {
          throwBadRequest(
            'CANNOT_DISABLE_OWN_EMPLOYEE',
            'Нельзя отключить сотрудника, связанного с текущей учётной записью.',
          );
        }

        const activeLinkedUsers = currentEmployee.employeeUsers
          .map((employeeUser) => employeeUser.user)
          .filter((user) => !user.banned);
        const hasEmployeeStatusChange = currentEmployee.isActive !== isActive;

        if (
          !hasEmployeeStatusChange &&
          (isActive || activeLinkedUsers.length === 0)
        ) {
          return toEmployeeDto(currentEmployee, params.actorUserId);
        }

        let employee = hasEmployeeStatusChange
          ? await tx.employee.update({
              data: { isActive },
              include: employeeAdminInclude,
              where: { id: params.employeeId },
            })
          : currentEmployee;

        if (!isActive && activeLinkedUsers.length > 0) {
          const disabledLinkedUserIds: string[] = [];

          for (const user of activeLinkedUsers) {
            const updateResult = await tx.user.updateMany({
              data: {
                banExpires: null,
                banReason:
                  'Отключено автоматически вследствие отключения связанного сотрудника',
                banned: true,
              },
              where: {
                id: user.id,
                OR: [{ banned: false }, { banned: null }],
              },
            });

            if (updateResult.count > 0) {
              disabledLinkedUserIds.push(user.id);
              await this.audit.logUserAutoDisabledForEmployee({
                actorUserId: params.actorUserId,
                oldBanned: user.banned,
                tx,
                userId: user.id,
              });
            }
          }

          if (disabledLinkedUserIds.length > 0) {
            await tx.session.deleteMany({
              where: { userId: { in: disabledLinkedUserIds } },
            });
          }

          employee = await tx.employee.findUniqueOrThrow({
            include: employeeAdminInclude,
            where: { id: params.employeeId },
          });
        }

        const employeeDto = toEmployeeDto(employee, params.actorUserId);

        if (hasEmployeeStatusChange) {
          await this.audit.logEmployeeStatusChanged({
            actorUserId: params.actorUserId,
            newEmployee: employeeDto,
            oldEmployee: toEmployeeDto(currentEmployee, params.actorUserId),
            tx,
          });
        }

        return employeeDto;
      });
    } catch (error) {
      throwNotFoundIfPrismaError(error, 'EMPLOYEE_NOT_FOUND');
      throw error;
    }
  }
}
