import { Injectable } from '@nestjs/common';
import { EventsLifecycleService } from '../events/events-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentEventStateAssertions } from './equipment-event-state.assertions';
import { EquipmentEventsQueryService } from './equipment-events-query.service';

@Injectable()
export class EquipmentEventsLifecycleService {
  constructor(
    private readonly eventsLifecycleService: EventsLifecycleService,
    private readonly prisma: PrismaService,
    private readonly stateAssertions: EquipmentEventStateAssertions,
    private readonly queryService: EquipmentEventsQueryService,
  ) {}

  async cancel(
    id: number,
    userId?: string | null,
  ): Promise<Awaited<ReturnType<EquipmentEventsQueryService['findOne']>>> {
    const lifecycleResult = await this.prisma.$transaction((tx) =>
      this.eventsLifecycleService.cancelInTransaction(tx, id, {}, userId, {
        assertScope: async (tx, eventId) => {
          await this.stateAssertions.assertEquipmentEventExists(tx, eventId);
        },
      }),
    );

    return this.queryService.findOne(lifecycleResult.eventId);
  }
}
