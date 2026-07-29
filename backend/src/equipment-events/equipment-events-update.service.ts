import { Injectable } from '@nestjs/common';
import { EquipmentEventExtensionService } from '../equipment-event-extension/equipment-event-extension.service';
import { EventsUpdateService } from '../events/events-update.service';
import type { EventUpdateExtensionOptions } from '../events/events-update.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  type EquipmentEventAuditSnapshot,
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventUpdatedAudit,
} from './equipment-events.audit';
import { EquipmentEventChecklistCreator } from './equipment-event-checklist.creator';
import { EquipmentEventsQueryService } from './equipment-events-query.service';
import { type UpdateCreatedEquipmentEventData } from './equipment-events.validation';

@Injectable()
export class EquipmentEventsUpdateService {
  constructor(
    private readonly checklistCreator: EquipmentEventChecklistCreator,
    private readonly equipmentExtensionService: EquipmentEventExtensionService,
    private readonly eventsUpdateService: EventsUpdateService,
    private readonly prisma: PrismaService,
    private readonly queryService: EquipmentEventsQueryService,
  ) {}

  async updateCreated(
    id: number,
    data: UpdateCreatedEquipmentEventData,
    userId?: string | null,
  ) {
    const updatedEventId = await this.prisma.$transaction(async (tx) => {
      let oldAuditSnapshot: EquipmentEventAuditSnapshot | null = null;

      const updateResult =
        await this.eventsUpdateService.updateCreatedInTransaction(
          tx,
          this.checklistCreator,
          id,
          data,
          userId,
          async ({ eventId, tx: callbackTx }) => {
            const preparedExtension =
              await this.equipmentExtensionService.prepareUpdateCreated(
                callbackTx,
                eventId,
                {
                  equipmentVisibleId: data.equipmentVisibleId,
                  maintenanceTypeId: data.maintenanceTypeId,
                },
              );
            oldAuditSnapshot = await getEquipmentEventAuditSnapshot(
              callbackTx,
              eventId,
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
                  assignments.map(
                    (assignment) => assignment.checklistTemplateId,
                  ),
                ),
            };

            if (!hasExtensionChanges) {
              return extensionOptions;
            }

            return {
              ...extensionOptions,
              updateExtension: ({ eventId, tx: updateTx }) =>
                this.equipmentExtensionService.updateCreated(
                  updateTx,
                  eventId,
                  preparedExtension,
                ),
            };
          },
        );

      if (!updateResult.updated || !oldAuditSnapshot) {
        return updateResult.eventId;
      }

      const auditSnapshot = await getEquipmentEventAuditSnapshot(
        tx,
        updateResult.eventId,
      );
      await writeEquipmentEventUpdatedAudit(tx, {
        newEvent: auditSnapshot,
        oldEvent: oldAuditSnapshot,
        userId,
      });

      return updateResult.eventId;
    });

    return this.queryService.findOne(updatedEventId);
  }
}
