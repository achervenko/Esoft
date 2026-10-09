import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { throwUserAdminNotFound } from './users-admin.errors';
import { throwBadRequest } from './users-admin.validation';

@Injectable()
export class UsersAdminAssertionsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertActiveEmployeeExists(
    employeeId: number,
    tx: Prisma.TransactionClient,
  ) {
    const [employee] = await tx.$queryRaw<
      Array<{ id: number; isActive: boolean }>
    >`
      SELECT id, is_active AS "isActive"
      FROM employees WHERE id = ${employeeId} FOR UPDATE
    `;

    if (!employee) {
      throwUserAdminNotFound('EMPLOYEE_NOT_FOUND');
    }

    if (!employee.isActive) {
      throwBadRequest(
        'EMPLOYEE_INACTIVE',
        'Нельзя привязать отключённого сотрудника к учётной записи.',
      );
    }
  }

  async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      select: { id: true },
      where: { id: userId },
    });

    if (!user) {
      throwUserAdminNotFound('USER_NOT_FOUND');
    }
  }
}
