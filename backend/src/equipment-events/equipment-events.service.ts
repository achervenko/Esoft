import { Injectable } from '@nestjs/common';
import { EquipmentEventsCreator } from './equipment-events.creator';
import { EquipmentEventsLifecycleService } from './equipment-events-lifecycle.service';
import { EquipmentEventsQueryService } from './equipment-events-query.service';
import { EquipmentEventsUpdateService } from './equipment-events-update.service';
import {
  type CompleteEquipmentEventData,
  type CreateManualEquipmentEventData,
  type EquipmentEventsQuery,
  type UpdateCreatedEquipmentEventData,
} from './equipment-events.validation';

@Injectable()
export class EquipmentEventsService {
  constructor(
    private readonly creator: EquipmentEventsCreator,
    private readonly lifecycleService: EquipmentEventsLifecycleService,
    private readonly queryService: EquipmentEventsQueryService,
    private readonly updateService: EquipmentEventsUpdateService,
  ) {}

  findAll(query: EquipmentEventsQuery) {
    return this.queryService.findAll(query);
  }

  findOne(id: number) {
    return this.queryService.findOne(id);
  }

  findResponsibleUsers() {
    return this.queryService.findResponsibleUsers();
  }

  async createManual(
    data: CreateManualEquipmentEventData,
    userId?: string | null,
  ) {
    const createdEventId = await this.creator.create(
      {
        kind: 'manual',
        equipmentVisibleId: data.equipmentVisibleId,
        maintenanceTypeId: data.maintenanceTypeId,
        note: data.note,
        plannedDate: data.plannedDate,
        responsibleUserIds: data.responsibleUserIds,
      },
      userId,
    );

    return this.queryService.findOne(createdEventId);
  }

  updateCreated(
    id: number,
    data: UpdateCreatedEquipmentEventData,
    userId?: string | null,
  ) {
    return this.updateService.updateCreated(id, data, userId);
  }

  complete(
    id: number,
    data: CompleteEquipmentEventData,
    userId?: string | null,
  ) {
    return this.lifecycleService.complete(id, data, userId);
  }

  start(id: number, userId?: string | null) {
    return this.lifecycleService.start(id, userId);
  }

  cancel(id: number, userId?: string | null) {
    return this.lifecycleService.cancel(id, userId);
  }
}
