import { Injectable } from '@nestjs/common';
import { EventExtensionCode, EventSource } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { EquipmentEventExtensionService } from '../equipment-event-extension/equipment-event-extension.service';
import { EventsCreateService } from '../events/events-create.service';
import type {
  CreateEventActor,
  CreateEventCommand,
} from '../events/events-create.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventCreatedAudit,
} from './equipment-events.audit';
import { EquipmentEventChecklistCreator } from './equipment-event-checklist.creator';
import { type EquipmentEventChecklistAssignment } from './equipment-events.validation';

export type CreateManualEquipmentEventCommand = {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  kind: 'manual';
  equipmentVisibleId: number;
  maintenanceTypeId: number;
  note: string | null;
  plannedDate: Date;
  responsibleUserIds: string[];
  title: string;
};

export type CreatePlannedEquipmentEventCommand = {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  kind: 'planned';
  equipmentVisibleId: number;
  eventTypeId: number;
  originalPlannedDate: Date;
  plannedDate: Date;
  responsibleUserIds: string[];
  title: string;
};

export type CreateEquipmentEventCommand =
  CreateManualEquipmentEventCommand | CreatePlannedEquipmentEventCommand;

export type CreateEquipmentEventActor = CreateEventActor;

@Injectable()
export class EquipmentEventsCreator {
  constructor(
    private readonly checklistCreator: EquipmentEventChecklistCreator,
    private readonly equipmentExtensionService: EquipmentEventExtensionService,
    private readonly eventsCreateService: EventsCreateService,
    private readonly prisma: PrismaService,
  ) {}

  create(
    command: CreateEquipmentEventCommand,
    actor: CreateEquipmentEventActor,
  ): Promise<number> {
    return this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, command, actor),
    );
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    command: CreateEquipmentEventCommand,
    actor: CreateEquipmentEventActor,
  ): Promise<number> {
    const maintenanceTypeId =
      command.kind === 'manual'
        ? command.maintenanceTypeId
        : command.eventTypeId;

    const preparedExtension =
      await this.equipmentExtensionService.prepareCreate(tx, {
        equipmentVisibleId: command.equipmentVisibleId,
        maintenanceTypeId,
      });

    const eventId = await this.eventsCreateService.createInTransaction(
      tx,
      this.toCreateEventCommand(command),
      actor,
      {
        createChecklists: async ({
          assignments,
          createdBy,
          eventId,
          tx: callbackTx,
        }) => {
          await this.checklistCreator.createEventChecklists(callbackTx, {
            assignments,
            createdBy,
            eventId,
          });
        },
        createExtension: ({ eventId, tx: callbackTx }) =>
          this.equipmentExtensionService.create(
            callbackTx,
            eventId,
            preparedExtension,
          ),
      },
    );

    const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, eventId);
    await writeEquipmentEventCreatedAudit(tx, {
      event: auditSnapshot,
      userId: actor.kind === 'user' ? actor.userId : null,
    });

    return eventId;
  }

  private toCreateEventCommand(
    command: CreateEquipmentEventCommand,
  ): CreateEventCommand {
    if (command.kind === 'manual') {
      return {
        checklistAssignments: command.checklistAssignments,
        extensionCode: EventExtensionCode.EQUIPMENT,
        note: command.note,
        originalPlannedDate: command.plannedDate,
        plannedDate: command.plannedDate,
        responsibleUserIds: command.responsibleUserIds,
        source: EventSource.MANUAL,
        title: command.title,
      };
    }

    return {
      checklistAssignments: command.checklistAssignments,
      extensionCode: EventExtensionCode.EQUIPMENT,
      note: null,
      originalPlannedDate: command.originalPlannedDate,
      plannedDate: command.plannedDate,
      responsibleUserIds: command.responsibleUserIds,
      source: EventSource.PLANNED,
      title: command.title,
    };
  }
}
