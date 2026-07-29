import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  EventUpdateExtensionOptions,
  EventUpdateExtensionOptionsResolver,
} from '../events/events-update.types';
import {
  getEquipmentEventExtensionAuditSnapshot,
  type EquipmentEventExtensionAuditSnapshot,
  writeEquipmentEventExtensionUpdatedAudit,
} from './equipment-event-extension.audit';
import type { EquipmentEventExtensionUpdateInput } from './equipment-event-extension.command.types';
import { EquipmentEventExtensionService } from './equipment-event-extension.service';

@Injectable()
export class EquipmentEventExtensionUpdate {
  constructor(
    private readonly extensionService: EquipmentEventExtensionService,
  ) {}

  buildUpdateOptionsResolver(params: {
    extension: EquipmentEventExtensionUpdateInput;
    userId?: string | null;
  }): EventUpdateExtensionOptionsResolver {
    return async ({ eventId, tx }) => {
      const preparedExtension =
        await this.extensionService.prepareUpdateCreated(
          tx,
          eventId,
          params.extension,
        );
      const hasExtensionChanges =
        preparedExtension.equipmentId !== undefined ||
        preparedExtension.eventTypeId !== undefined ||
        preparedExtension.maintenanceSetting !== undefined;
      const extensionOptions: EventUpdateExtensionOptions = {
        hasExtensionChanges,
        requiresChecklistAssignments: hasExtensionChanges,
        validateChecklists: ({ assignments, tx: validateTx }) =>
          this.extensionService.assertChecklistTemplatesAllowed(
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
          await this.writeUpdateAudit(updateTx, {
            eventId: updatedEventId,
            oldAuditSnapshot,
            userId: params.userId,
          });
        },
        updateExtension: ({ eventId: updatedEventId, tx: updateTx }) =>
          this.extensionService.updateCreated(
            updateTx,
            updatedEventId,
            preparedExtension,
          ),
      };
    };
  }

  private async writeUpdateAudit(
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
