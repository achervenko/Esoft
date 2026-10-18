import { getUserPermissions } from '../auth/permission-policy';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ACTIVE_MODULES } from '../config/active-modules.module';
import { getEffectiveUserRoles } from '../auth/role-module-policy';
import { PrismaService } from '../prisma/prisma.service';
import { toUserPhotoDto } from './user-photo.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACTIVE_MODULES) private readonly activeModules: readonly string[],
  ) {}

  async findProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        employeeUser: {
          include: {
            employee: { include: { position: true } },
          },
        },
        photo: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден.');
    }

    const employee = user.employeeUser?.employee ?? null;

    const role = getEffectiveUserRoles(user.role, this.activeModules).join(',');
    return {
      id: user.id,
      displayUsername: user.displayUsername,
      email: user.email,
      name: user.name,
      photo: toUserPhotoDto(user.photo),
      assignedRole: user.role,
      role,
      permissions: getUserPermissions(role),
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
            position: employee.position.name,
          }
        : null,
    };
  }
}
