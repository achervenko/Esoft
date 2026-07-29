import { Injectable } from '@nestjs/common';
import { EventExtensionCode } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { EquipmentEventExtensionService } from '../equipment-event-extension/equipment-event-extension.service';
import { EventChecklistCreator } from '../events/event-checklists/event-checklist.creator';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';
import { type EquipmentEventChecklistAssignment } from './equipment-events.validation';

@Injectable()
export class EquipmentEventChecklistCreator {
  constructor(
    private readonly equipmentExtensionService: EquipmentEventExtensionService,
    private readonly eventChecklistCreator: EventChecklistCreator,
  ) {}

  async createEventChecklists(
    tx: Prisma.TransactionClient,
    params: {
      assignments: EquipmentEventChecklistAssignment[];
      createdBy: string;
      eventId: number;
      temporarySortOrders?: number[];
      validateFullResponsibleCoverage?: boolean;
    },
  ): Promise<Array<{ assignedUserId: string; id: number }>> {
    const event = await tx.event.findUnique({
      select: {
        equipmentExtension: {
          select: { maintenanceSettingId: true },
        },
        extensionCode: true,
        id: true,
      },
      where: { id: params.eventId },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    if (
      event.extensionCode !== EventExtensionCode.EQUIPMENT ||
      !event.equipmentExtension
    ) {
      throwEquipmentEventBadRequest(
        'EVENT_EXTENSION_REQUIRED',
        'Событие не относится к расширению оборудования.',
      );
    }

    const maintenanceSettingId = event.equipmentExtension.maintenanceSettingId;

    await this.assertChecklistTemplatesAllowed(tx, params.assignments, {
      maintenanceSettingId,
    });

    return this.eventChecklistCreator.createEventChecklists(tx, {
      assignments: params.assignments,
      createdBy: params.createdBy,
      eventId: params.eventId,
      temporarySortOrders: params.temporarySortOrders,
      validateFullResponsibleCoverage: params.validateFullResponsibleCoverage,
    });
  }

  private async assertChecklistTemplatesAllowed(
    tx: Prisma.TransactionClient,
    assignments: EquipmentEventChecklistAssignment[],
    options: {
      maintenanceSettingId: number;
    },
  ): Promise<void> {
    const checklistTemplateIds = [
      ...new Set(
        assignments.map((assignment) => assignment.checklistTemplateId),
      ),
    ];

    if (checklistTemplateIds.length === 0) {
      return;
    }

    await this.equipmentExtensionService.assertChecklistTemplatesAllowed(
      tx,
      options.maintenanceSettingId,
      checklistTemplateIds,
    );
  }
}
