import { Injectable } from '@nestjs/common';
import type { EventCreateOptions } from '../events/events-create.types';
import type { CreateEventChecklistsHandler } from '../events/event-extensions/event-extension.adapter';
import {
  getEquipmentEventExtensionAuditSnapshot,
  writeEquipmentEventExtensionCreatedAudit,
} from './equipment-event-extension.audit';
import type {
  EquipmentEventExtensionCreateInput,
  PreparedEquipmentEventExtensionCreate,
} from './equipment-event-extension.command.types';
import { EquipmentEventExtensionService } from './equipment-event-extension.service';

@Injectable()
export class EquipmentEventExtensionCreate {
  constructor(
    private readonly extensionService: EquipmentEventExtensionService,
  ) {}

  buildCreateOptions(params: {
    createChecklists: CreateEventChecklistsHandler;
    extension: EquipmentEventExtensionCreateInput;
    userId: string;
  }): EventCreateOptions<PreparedEquipmentEventExtensionCreate> {
    return {
      afterCreate: async ({ eventId, tx }) => {
        const auditSnapshot = await getEquipmentEventExtensionAuditSnapshot(
          tx,
          eventId,
        );

        await writeEquipmentEventExtensionCreatedAudit(tx, {
          event: auditSnapshot,
          userId: params.userId,
        });
      },
      createChecklists: async ({
        assignments,
        createdBy,
        eventId,
        extensionContext: preparedExtension,
        tx,
      }) => {
        await this.extensionService.assertChecklistTemplatesAllowed(
          tx,
          preparedExtension.maintenanceSettingId,
          assignments.map((assignment) => assignment.checklistTemplateId),
        );
        await params.createChecklists({
          assignments,
          createdBy,
          eventId,
          tx,
        });
      },
      createExtension: async ({ eventId, tx }) => {
        const preparedExtension = await this.extensionService.prepareCreate(
          tx,
          params.extension,
        );
        await this.extensionService.create(tx, eventId, preparedExtension);

        return preparedExtension;
      },
    };
  }
}
