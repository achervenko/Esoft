import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SetupController } from './setup.controller';
import { SetupAuditService } from './setup-audit.service';
import { SetupAuthService } from './setup-auth.service';
import { SetupService } from './setup.service';
import { SetupStateService } from './setup-state.service';

@Module({
  controllers: [SetupController],
  imports: [PrismaModule],
  providers: [
    SetupAuditService,
    SetupAuthService,
    SetupService,
    SetupStateService,
  ],
})
export class SetupModule {}
