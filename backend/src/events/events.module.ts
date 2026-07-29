import { Module } from '@nestjs/common';
import { ChecklistsModule } from '../checklists/checklists.module';
import { PrismaModule } from '../prisma/prisma.module';
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

@Module({
  imports: [PrismaModule, ChecklistsModule],
  controllers: [EventsController],
  providers: [
    EventChecklistCreator,
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
