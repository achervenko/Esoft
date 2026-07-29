import { Injectable } from '@nestjs/common';
import { EventChecklistCreator } from './event-checklists/event-checklist.creator';
import { EventsCreateService } from './events-create.service';
import { EventsLifecycleService } from './events-lifecycle.service';
import {
  EventsQueryService,
  type EventsListRecordsQuery,
} from './events-query.service';
import { EventsUpdateService } from './events-update.service';
import type { CreateEventCommand } from './events-create.types';
import type {
  CancelEventData,
  CompleteEventData,
  StartEventData,
} from './events-lifecycle.types';
import type { UpdateCreatedEventData } from './events-update.types';

@Injectable()
export class EventsService {
  constructor(
    private readonly checklistCreator: EventChecklistCreator,
    private readonly createService: EventsCreateService,
    private readonly lifecycleService: EventsLifecycleService,
    private readonly queryService: EventsQueryService,
    private readonly updateService: EventsUpdateService,
  ) {}

  async create(
    data: CreateEventCommand,
    userId: string,
  ): Promise<Awaited<ReturnType<EventsQueryService['findOne']>>> {
    const eventId = await this.createService.create(
      data,
      {
        kind: 'user',
        userId,
      },
      {
        createChecklists: async ({ assignments, createdBy, eventId, tx }) => {
          await this.checklistCreator.createEventChecklists(tx, {
            assignments,
            createdBy,
            eventId,
          });
        },
      },
    );

    return this.queryService.findOne(eventId);
  }

  findAll(
    query: EventsListRecordsQuery,
  ): ReturnType<EventsQueryService['findAll']> {
    return this.queryService.findAll(query);
  }

  findOne(id: number): ReturnType<EventsQueryService['findOne']> {
    return this.queryService.findOne(id);
  }

  async updateCreated(
    id: number,
    data: UpdateCreatedEventData,
    userId?: string | null,
  ): Promise<Awaited<ReturnType<EventsQueryService['findOne']>>> {
    const updateResult = await this.updateService.updateCreated(
      this.checklistCreator,
      id,
      data,
      userId,
    );

    return this.queryService.findOne(updateResult.eventId);
  }

  async start(
    id: number,
    data: StartEventData,
    userId?: string | null,
  ): Promise<Awaited<ReturnType<EventsQueryService['findOne']>>> {
    const lifecycleResult = await this.lifecycleService.start(id, data, userId);

    return this.queryService.findOne(lifecycleResult.eventId);
  }

  async complete(
    id: number,
    data: CompleteEventData,
    userId?: string | null,
  ): Promise<Awaited<ReturnType<EventsQueryService['findOne']>>> {
    const lifecycleResult = await this.lifecycleService.complete(
      id,
      data,
      userId,
    );

    return this.queryService.findOne(lifecycleResult.eventId);
  }

  async cancel(
    id: number,
    data: CancelEventData,
    userId?: string | null,
  ): Promise<Awaited<ReturnType<EventsQueryService['findOne']>>> {
    const lifecycleResult = await this.lifecycleService.cancel(
      id,
      data,
      userId,
    );

    return this.queryService.findOne(lifecycleResult.eventId);
  }
}
