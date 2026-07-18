import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parsePassword } from './users-admin.validation';
import {
  CREDENTIAL_PROVIDER_ID,
  hashUserPassword,
} from './users-admin-credential-account';
import { UsersAdminAssertionsService } from './users-admin-assertions.service';
import { UsersAdminAuditService } from './users-admin-audit.service';
import { toAdminUserDto } from './users-admin.mapper';

type AdminUserWithRelations = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

@Injectable()
export class UserCredentialsAdminService {
  private readonly logger = new Logger(UserCredentialsAdminService.name);

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

    const passwordHash = await hashUserPassword(
      parsePassword(payload.password),
    );
    const user = await this.prisma.$transaction(async (tx) => {
      await this.lockUserCredentials(tx, userId);
      const account = await this.findCredentialAccount(tx, userId);

      if (account) {
        await tx.account.update({
          data: { password: passwordHash },
          where: { id: account.id },
        });
      } else {
        await tx.account.create({
          data: {
            accountId: userId,
            id: randomUUID(),
            password: passwordHash,
            providerId: CREDENTIAL_PROVIDER_ID,
            userId,
          },
        });
      }

      return tx.user.findUniqueOrThrow({
        include: adminUserInclude,
        where: { id: userId },
      });
    });
    await this.logPasswordChangedBestEffort(user, actorUserId);

    return { ok: true };
  }

  private findCredentialAccount(tx: Prisma.TransactionClient, userId: string) {
    return tx.account.findFirst({
      select: { id: true },
      where: {
        accountId: userId,
        providerId: CREDENTIAL_PROVIDER_ID,
        userId,
      },
    });
  }

  private lockUserCredentials(tx: Prisma.TransactionClient, userId: string) {
    return tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${'user_credentials:' + userId}))
    `;
  }

  private async logPasswordChangedBestEffort(
    user: AdminUserWithRelations,
    actorUserId?: string | null,
  ) {
    try {
      await this.audit.logUserPasswordChanged(
        toAdminUserDto(user),
        actorUserId,
      );
    } catch (error) {
      this.logger.error(
        'Failed to write user password change audit log',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

const adminUserInclude = {
  employeeUser: {
    include: {
      employee: true,
    },
  },
  photo: true,
};
