import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesAdminService } from './employees-admin.service';
import { UserAccountsAdminService } from './user-accounts-admin.service';
import { UserCredentialsAdminService } from './user-credentials-admin.service';
import { UserStatusAdminService } from './user-status-admin.service';
import { UsersAdminAssertionsService } from './users-admin-assertions.service';
import { UsersAdminAuditService } from './users-admin-audit.service';
import { UsersAdminController } from './users-admin.controller';

@Module({
  imports: [AuditModule],
  controllers: [UsersAdminController],
  providers: [
    EmployeesAdminService,
    PrismaService,
    UserAccountsAdminService,
    UserCredentialsAdminService,
    UsersAdminAssertionsService,
    UsersAdminAuditService,
    UserStatusAdminService,
  ],
})
export class UsersAdminModule {}
