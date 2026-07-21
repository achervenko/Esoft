import { Injectable, Logger } from '@nestjs/common';
import { auth } from '../auth/auth.config';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CreateInitialAdminInput,
  type SetupEmployeeRow,
  formatSetupEmployeeFullName,
} from './setup.types';

@Injectable()
export class SetupAuthService {
  private readonly logger = new Logger(SetupAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createInitialAdminUser(
    input: CreateInitialAdminInput,
    employee: SetupEmployeeRow,
  ) {
    const response = await auth.api.createUser({
      body: {
        data: {
          banned: false,
          displayUsername: input.username,
          emailVerified: true,
          username: input.username,
        },
        email: input.email,
        name: formatSetupEmployeeFullName(employee),
        password: input.password,
        role: 'admin',
      },
    });

    return response.user;
  }

  async cleanupCreatedAuthUser(userId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.session.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.user.deleteMany({ where: { id: userId } });
      });
    } catch (error) {
      this.logger.error(
        'Failed to compensate initial administrator auth user creation',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
