import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parsePassword } from './users-admin.validation';
import {
  CREDENTIAL_PROVIDER_ID,
  hashUserPassword,
} from './users-admin-credential-account';
import { UsersAdminAssertionsService } from './users-admin-assertions.service';
import { UsersAdminAuditService } from './users-admin-audit.service';
import { toAdminUserDto } from './users-admin.mapper';

@Injectable()
export class UserCredentialsAdminService {
  constructor(
    private readonly assertions: UsersAdminAssertionsService,
    private readonly audit: UsersAdminAuditService,
    private readonly prisma: PrismaService,
  ) {}

  async setUserPassword(
    userId: string,
    payload: { password?: unknown },
    actorUserId?: string | null,
  ) {
    await this.assertions.assertUserExists(userId);

    const passwordHash = await hashUserPassword(parsePassword(payload.password));
    const account = await this.findCredentialAccount(userId);

    if (account) {
      await this.prisma.account.update({
        data: { password: passwordHash },
        where: { id: account.id },
      });
    } else {
      await this.prisma.account.create({
        data: {
          accountId: userId,
          id: randomUUID(),
          password: passwordHash,
          providerId: CREDENTIAL_PROVIDER_ID,
          userId,
        },
      });
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      include: {
        employeeUser: {
          include: {
            employee: true,
          },
        },
        photo: true,
      },
      where: { id: userId },
    });
    await this.audit.logUserPasswordChanged(toAdminUserDto(user), actorUserId);

    return { ok: true };
  }

  private findCredentialAccount(userId: string) {
    return this.prisma.account.findFirst({
      select: { id: true },
      where: {
        accountId: userId,
        providerId: CREDENTIAL_PROVIDER_ID,
        userId,
      },
    });
  }
}
