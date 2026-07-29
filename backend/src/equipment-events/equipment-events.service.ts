import { Injectable } from '@nestjs/common';
import { EquipmentEventsCreator } from './equipment-events.creator';
import { EquipmentEventsLifecycleService } from './equipment-events-lifecycle.service';
import { EquipmentEventsQueryService } from './equipment-events-query.service';
import { EquipmentEventsUpdateService } from './equipment-events-update.service';
import {
  type CreateManualEquipmentEventData,
  type EquipmentEventsQuery,
  type UpdateCreatedEquipmentEventData,
} from './equipment-events.validation';
import { requireUserId } from './equipment-events-update.utils';

@Injectable()
export class EquipmentEventsService {
  constructor(
    private readonly creator: EquipmentEventsCreator,
    private readonly lifecycleService: EquipmentEventsLifecycleService,
    private readonly queryService: EquipmentEventsQueryService,
    private readonly updateService: EquipmentEventsUpdateService,
  ) {}

  findAll(
    query: EquipmentEventsQuery,
  ): ReturnType<EquipmentEventsQueryService['findAll']> {
    return this.queryService.findAll(query);
  }

  findOne(id: number): ReturnType<EquipmentEventsQueryService['findOne']> {
    return this.queryService.findOne(id);
  }

  findResponsibleUsers(): ReturnType<
    EquipmentEventsQueryService['findResponsibleUsers']
  > {
    return this.queryService.findResponsibleUsers();
  }

  async createManual(
    data: CreateManualEquipmentEventData,
    userId?: string | null,
  ): Promise<Awaited<ReturnType<EquipmentEventsQueryService['findOne']>>> {
    const actorUserId = requireUserId(userId);
    const createdEventId = await this.creator.create(
      {
        kind: 'manual',
        checklistAssignments: data.checklistAssignments,
        equipmentVisibleId: data.equipmentVisibleId,
        maintenanceTypeId: data.maintenanceTypeId,
        note: data.note,
        plannedDate: data.plannedDate,
        responsibleUserIds: data.responsibleUserIds,
        title: data.title,
      },
      { kind: 'user', userId: actorUserId },
    );

    return this.queryService.findOne(createdEventId);
  }

  updateCreated(
    id: number,
    data: UpdateCreatedEquipmentEventData,
    userId?: string | null,
  ): ReturnType<EquipmentEventsUpdateService['updateCreated']> {
    return this.updateService.updateCreated(id, data, userId);
  }

  cancel(
    id: number,
    userId?: string | null,
  ): ReturnType<EquipmentEventsLifecycleService['cancel']> {
    return this.lifecycleService.cancel(id, userId);
  }
}
