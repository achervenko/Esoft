import { Injectable } from '@nestjs/common';
import type { EventExtensionCode } from '@prisma/client';
import { EventExtensionRegistry } from './event-extensions/event-extension.registry';
import { EventChecklistCreator } from './event-checklists/event-checklist.creator';
import { EventsCreateService } from './events-create.service';
import { EventsLifecycleService } from './events-lifecycle.service';
import {
  EventsQueryService,
  type EventsListRecordsQuery,
} from './events-query.service';
import { EventsUpdateService } from './events-update.service';
import type { EventCreateOptions } from './events-create.types';
import type {
  CancelEventData,
  CompleteEventData,
  StartEventData,
} from './events-lifecycle.types';
import type { EventUpdateExtensionOptionsResolver } from './events-update.types';
import { throwEventBadRequest } from './events.errors';
import type { CreateEventData } from './events-create.validation';
import type { UpdateCreatedEventPayload } from './events-update.validation';

@Injectable()
export class EventsService {
  constructor(
    private readonly checklistCreator: EventChecklistCreator,
    private readonly createService: EventsCreateService,
    private readonly extensionRegistry: EventExtensionRegistry,
    private readonly lifecycleService: EventsLifecycleService,
    private readonly queryService: EventsQueryService,
    private readonly updateService: EventsUpdateService,
  ) {}

  async create(
    data: CreateEventData,
    userId: string,
  ): Promise<Awaited<ReturnType<EventsQueryService['findOne']>>> {
    const eventId = await this.createService.create(
      data,
      {
        kind: 'user',
        userId,
      },
      this.buildCreateOptions(data, userId),
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

  findResponsibleUsers(): ReturnType<
    EventsQueryService['findResponsibleUsers']
  > {
    return this.queryService.findResponsibleUsers();
  }

  async updateCreated(
    id: number,
    data: UpdateCreatedEventPayload,
    userId?: string | null,
  ): Promise<Awaited<ReturnType<EventsQueryService['findOne']>>> {
    const { extension, ...eventData } = data;
    const updateResult =
      extension === undefined
        ? await this.updateService.updateCreated(
            this.checklistCreator,
            id,
            eventData,
            userId,
          )
        : await this.updateService.updateCreated(
            this.checklistCreator,
            id,
            eventData,
            userId,
            this.buildUpdateExtensionOptionsResolver(extension, userId),
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

  private buildCreateOptions(
    data: CreateEventData,
    userId: string,
  ): EventCreateOptions {
    const createChecklists: EventCreateOptions['createChecklists'] = async ({
      assignments,
      createdBy,
      eventId,
      tx,
    }) => {
      await this.checklistCreator.createEventChecklists(tx, {
        assignments,
        createdBy,
        eventId,
      });
    };

    if (data.extensionCode === null) {
      return {
        createChecklists,
      };
    }

    return this.extensionRegistry
      .getAdapter(data.extensionCode)
      .buildCreateOptions({
        createChecklists,
        extension: data.extension,
        userId,
      });
  }

  private buildUpdateExtensionOptionsResolver(
    extension: Record<string, unknown>,
    userId?: string | null,
  ): EventUpdateExtensionOptionsResolver {
    return async (params) => {
      const adapter = this.getUpdateAdapter(params.currentState.extensionCode);

      return adapter.buildUpdateOptionsResolver({
        extension,
        userId,
      })(params);
    };
  }

  private getUpdateAdapter(extensionCode: EventExtensionCode | null) {
    if (extensionCode === null) {
      throwEventBadRequest(
        'EVENT_EXTENSION_UNEXPECTED',
        'Для события без типа расширения нельзя передавать данные расширения.',
      );
    }

    return this.extensionRegistry.getAdapter(extensionCode);
  }
}
