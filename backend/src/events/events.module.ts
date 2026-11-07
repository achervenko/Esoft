import {
  ActiveModulesModule,
  loadActiveModules,
} from '../config/active-modules.module';
import { Module, type Type } from '@nestjs/common';
import { createRequire } from 'node:module';
import { ChecklistsModule } from '../checklists/checklists.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventExtensionRegistry } from './event-extensions/event-extension.registry';
import { EventChecklistCreator } from './event-checklists/event-checklist.creator';
import { EventsAccessAssertions } from './events-access.assertions';
import { EventsCreateService } from './events-create.service';
import { EventsController } from './events.controller';
import { EventsLifecycleService } from './events-lifecycle.service';
import { EventsLifecycleRepository } from './events-lifecycle.repository';
import { EventsQueryService } from './events-query.service';
import { EventsService } from './events.service';
import { EventsUpdateInputLoader } from './events-update-input.loader';
import { EventsUpdateService } from './events-update.service';

const equipmentExtensions = loadActiveModules().includes('equipment')
  ? [
      (
        createRequire(__filename)(
          '../equipment-event-extension/equipment-event-extension.module',
        ) as { EquipmentEventExtensionModule: Type<unknown> }
      ).EquipmentEventExtensionModule,
    ]
  : [];

@Module({
  imports: [
    ActiveModulesModule,
    PrismaModule,
    ChecklistsModule,
    ...equipmentExtensions,
  ],
  controllers: [EventsController],
  providers: [
    EventChecklistCreator,
    EventExtensionRegistry,
    EventsAccessAssertions,
    EventsCreateService,
    EventsLifecycleRepository,
    EventsLifecycleService,
    EventsQueryService,
    EventsService,
    EventsUpdateInputLoader,
    EventsUpdateService,
  ],
  exports: [
    EventChecklistCreator,
    EventsCreateService,
    EventsLifecycleService,
    EventsQueryService,
    EventsService,
    EventsUpdateService,
  ],
})
export class EventsModule {}
