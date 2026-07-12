import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { throwUserAdminNotFound } from './users-admin.errors';

@Injectable()
export class UsersAdminAssertionsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertEmployeeExists(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      select: { id: true },
      where: { id: employeeId },
    });

    if (!employee) {
      throwUserAdminNotFound('EMPLOYEE_NOT_FOUND');
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
