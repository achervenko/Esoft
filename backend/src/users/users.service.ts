import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        employeeUser: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден.');
    }

    const employee = user.employeeUser?.employee ?? null;

    return {
      id: user.id,
      displayUsername: user.displayUsername,
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username,
      employee: employee
        ? {
            id: employee.id,
            displayName: [employee.firstName, employee.middleName]
              .filter(Boolean)
              .join(' '),
            firstName: employee.firstName,
            fullName: [
              employee.lastName,
              employee.firstName,
              employee.middleName,
            ]
              .filter(Boolean)
              .join(' '),
            lastName: employee.lastName,
            middleName: employee.middleName,
            position: employee.position,
          }
        : null,
    };
  }
}
