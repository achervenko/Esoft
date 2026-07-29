import { Injectable } from '@nestjs/common';
import { EventExtensionCode } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type {
  EquipmentEventExtensionCreateInput,
  EquipmentEventExtensionUpdateInput,
  PreparedEquipmentEventExtensionCreate,
} from '../equipment-event-extension/equipment-event-extension.command.types';
import {
  type EquipmentEventExtensionAuditSnapshot,
  getEquipmentEventExtensionAuditSnapshot,
  writeEquipmentEventExtensionCreatedAudit,
  writeEquipmentEventExtensionUpdatedAudit,
} from '../equipment-event-extension/equipment-event-extension.audit';
import { EquipmentEventExtensionService } from '../equipment-event-extension/equipment-event-extension.service';
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
import type {
  EventUpdateExtensionOptions,
  EventUpdateExtensionOptionsResolver,
} from './events-update.types';
import type { CreateEventData } from './events-create.validation';
import type { UpdateCreatedEventPayload } from './events-update.validation';

@Injectable()
export class EventsService {
  constructor(
    private readonly checklistCreator: EventChecklistCreator,
    private readonly createService: EventsCreateService,
    private readonly equipmentExtensionService: EquipmentEventExtensionService,
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
    if (data.extensionCode !== EventExtensionCode.EQUIPMENT) {
      return {
        createChecklists: async ({ assignments, createdBy, eventId, tx }) => {
          await this.checklistCreator.createEventChecklists(tx, {
            assignments,
            createdBy,
            eventId,
          });
        },
      };
    }

    let preparedExtension: PreparedEquipmentEventExtensionCreate | null = null;
    const extension = data.extension as EquipmentEventExtensionCreateInput;

    return {
      afterCreate: async ({ eventId, tx }) => {
        const auditSnapshot = await getEquipmentEventExtensionAuditSnapshot(
          tx,
          eventId,
        );

        await writeEquipmentEventExtensionCreatedAudit(tx, {
          event: auditSnapshot,
          userId,
        });
      },
      createChecklists: async ({ assignments, createdBy, eventId, tx }) => {
        if (!preparedExtension) {
          throw new Error('Equipment extension must be prepared first.');
        }

        await this.equipmentExtensionService.assertChecklistTemplatesAllowed(
          tx,
          preparedExtension.maintenanceSettingId,
          assignments.map((assignment) => assignment.checklistTemplateId),
        );
        await this.checklistCreator.createEventChecklists(tx, {
          assignments,
          createdBy,
          eventId,
        });
      },
      createExtension: async ({ eventId, tx }) => {
        preparedExtension = await this.equipmentExtensionService.prepareCreate(
          tx,
          extension,
        );
        await this.equipmentExtensionService.create(
          tx,
          eventId,
          preparedExtension,
        );
      },
    };
  }

  private buildUpdateExtensionOptionsResolver(
    extension: EquipmentEventExtensionUpdateInput,
    userId?: string | null,
  ): EventUpdateExtensionOptionsResolver {
    return async ({ eventId, tx }) => {
      const preparedExtension =
        await this.equipmentExtensionService.prepareUpdateCreated(
          tx,
          eventId,
          extension,
        );
      const hasExtensionChanges =
        preparedExtension.equipmentId !== undefined ||
        preparedExtension.eventTypeId !== undefined ||
        preparedExtension.maintenanceSetting !== undefined;
      const extensionOptions: EventUpdateExtensionOptions = {
        hasExtensionChanges,
        requiresChecklistAssignments: hasExtensionChanges,
        validateChecklists: ({ assignments, tx: validateTx }) =>
          this.equipmentExtensionService.assertChecklistTemplatesAllowed(
            validateTx,
            preparedExtension.finalMaintenanceSettingId,
            assignments.map((assignment) => assignment.checklistTemplateId),
          ),
      };

      if (!hasExtensionChanges) {
        return extensionOptions;
      }

      const oldAuditSnapshot = await getEquipmentEventExtensionAuditSnapshot(
        tx,
        eventId,
      );

      return {
        ...extensionOptions,
        afterUpdate: async ({ eventId: updatedEventId, tx: updateTx }) => {
          await this.writeEquipmentUpdateAudit(updateTx, {
            eventId: updatedEventId,
            oldAuditSnapshot,
            userId,
          });
        },
        updateExtension: ({ eventId: updatedEventId, tx: updateTx }) =>
          this.equipmentExtensionService.updateCreated(
            updateTx,
            updatedEventId,
            preparedExtension,
          ),
      };
    };
  }

  private async writeEquipmentUpdateAudit(
    tx: Prisma.TransactionClient,
    params: {
      eventId: number;
      oldAuditSnapshot: EquipmentEventExtensionAuditSnapshot;
      userId?: string | null;
    },
  ): Promise<void> {
    const auditSnapshot = await getEquipmentEventExtensionAuditSnapshot(
      tx,
      params.eventId,
    );

    await writeEquipmentEventExtensionUpdatedAudit(tx, {
      newEvent: auditSnapshot,
      oldEvent: params.oldAuditSnapshot,
      userId: params.userId,
    });
  }
}
