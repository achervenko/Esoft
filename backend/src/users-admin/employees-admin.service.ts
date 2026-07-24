import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toEmployeeDto } from './users-admin.mapper';
import {
  parseBoolean,
  parseEmployeePayload,
  throwBadRequest,
} from './users-admin.validation';
import { throwNotFoundIfPrismaError } from './users-admin.errors';
import { UsersAdminAuditService } from './users-admin-audit.service';

type EmployeePayload = Parameters<typeof parseEmployeePayload>[0];

@Injectable()
export class EmployeesAdminService {
  constructor(
    private readonly audit: UsersAdminAuditService,
    private readonly prisma: PrismaService,
  ) {}

  async listEmployees(currentUserId?: string | null) {
    const employees = await this.prisma.employee.findMany({
      include: {
        _count: {
          select: {
            employeeUsers: true,
            responsibleEquipment: true,
          },
        },
        employeeUsers: {
          select: {
            user: {
              select: {
                banned: true,
                id: true,
              },
            },
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
        { middleName: 'asc' },
      ],
    });

    return employees.map((employee) => toEmployeeDto(employee, currentUserId));
  }

  async createEmployee(payload: EmployeePayload, actorUserId?: string | null) {
    const employee = await this.prisma.$transaction(async (tx) => {
      const nextEmployee = await tx.employee.create({
        data: parseEmployeePayload(payload),
      });

      await this.audit.logEmployeeCreated(nextEmployee, actorUserId, tx);

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
            employeeUsers: {
              select: {
                user: {
                  select: {
                    banned: true,
                    id: true,
                  },
                },
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

        return toEmployeeDto(employee, actorUserId);
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
          include: {
            _count: {
              select: {
                employeeUsers: true,
                responsibleEquipment: true,
              },
            },
            employeeUsers: {
              select: {
                user: {
                  select: {
                    banned: true,
                    id: true,
                  },
                },
              },
            },
          },
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
              include: {
                _count: {
                  select: {
                    employeeUsers: true,
                    responsibleEquipment: true,
                  },
                },
                employeeUsers: {
                  select: {
                    user: {
                      select: {
                        banned: true,
                        id: true,
                      },
                    },
                  },
                },
              },
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
            include: {
              _count: {
                select: {
                  employeeUsers: true,
                  responsibleEquipment: true,
                },
              },
              employeeUsers: {
                select: {
                  user: {
                    select: {
                      banned: true,
                      id: true,
                    },
                  },
                },
              },
            },
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
