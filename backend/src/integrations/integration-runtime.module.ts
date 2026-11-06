import { IntegrationFlowsService } from './integration-flows.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationSchedulerService } from './integration-scheduler.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { MachineApiKeysModule } from '../auth/machine-api-keys.module';
import { IntegrationsModule } from './integrations.module';
import { IntegrationSourcesService } from './integration-sources.service';
import { IntegrationKeysService } from './integration-keys.service';
import { IntegrationEventsService } from './integration-events.service';
import { IntegrationWorkerService } from './integration-worker.service';
@Module({
  imports: [
    IntegrationsModule,
    PrismaModule,
    AuditModule,
    MachineApiKeysModule,
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationFlowsService,
    IntegrationSchedulerService,
    IntegrationSourcesService,
    IntegrationKeysService,
    IntegrationEventsService,
    IntegrationWorkerService,
  ],
  exports: [
    IntegrationSourcesService,
    IntegrationKeysService,
    IntegrationEventsService,
    IntegrationWorkerService,
  ],
})
export class IntegrationRuntimeModule {}
