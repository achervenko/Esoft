import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { translateSetupPrismaError } from './setup.errors';
import { SetupAuditService } from './setup-audit.service';
import { SetupAuthService } from './setup-auth.service';
import { lockSetupTransaction } from './setup-lock';
import { SetupStateService } from './setup-state.service';
import {
  type CreateInitialAdminInput,
  type SetupRequestMeta,
  type SetupStatusDto,
} from './setup.types';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly audit: SetupAuditService,
    private readonly auth: SetupAuthService,
    private readonly prisma: PrismaService,
    private readonly state: SetupStateService,
  ) {}

  async getStatus(): Promise<SetupStatusDto> {
    const setupRequired = !(await this.state.hasActiveAdministrator());

    if (setupRequired) {
      this.logger.log('Initial setup is required');
    }

    return { setupRequired };
  }

  listEmployees() {
    return this.state.listEmployees();
  }

  async createInitialAdmin(
    input: CreateInitialAdminInput,
    meta: SetupRequestMeta,
  ): Promise<{ ok: true }> {
    let createdUserId: string | null = null;

    try {
      await this.prisma.$transaction(async (tx) => {
        await lockSetupTransaction(tx);
        await this.state.assertSetupRequired(tx);

        await this.state.assertEmailAndUsernameAvailable(input, tx);
        const employee = await this.state.lockSetupEmployee(
          input.employeeId,
          tx,
        );
        const user = await this.auth.createInitialAdminUser(input, employee);
        createdUserId = user.id;

        await tx.employeeUser.create({
          data: {
            employeeId: employee.id,
            userId: user.id,
          },
        });

        await this.audit.logInitialAdminCreated(tx, {
          employeeId: employee.id,
          meta,
          userId: user.id,
        });
      });

      this.logger.log('Initial administrator created');
      this.logger.log('Initial setup completed');

      return { ok: true };
    } catch (error) {
      this.logger.error(
        'Failed to create initial administrator',
        this.formatSafeErrorLog(error, input),
      );

      if (createdUserId) {
        try {
          await this.auth.cleanupCreatedAuthUser(createdUserId);
        } catch (cleanupError) {
          this.logger.error(
            'Failed to cleanup initial administrator authentication user',
            this.formatCleanupErrorLog(cleanupError, createdUserId),
          );
        }
      }

      translateSetupPrismaError(error);
    }
  }

  private formatSafeErrorLog(
    error: unknown,
    input: Pick<CreateInitialAdminInput, 'email' | 'employeeId' | 'username'>,
  ) {
    return JSON.stringify({
      email: input.email,
      employeeId: input.employeeId,
      errorName: error instanceof Error ? error.name : typeof error,
      username: input.username,
    });
  }

  private formatCleanupErrorLog(error: unknown, userId: string) {
    return JSON.stringify({
      errorName: error instanceof Error ? error.name : typeof error,
      userId,
    });
  }
}
