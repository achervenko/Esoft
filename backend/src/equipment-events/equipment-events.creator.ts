import { Injectable } from '@nestjs/common';
import {
  EquipmentEventSource,
  EquipmentEventStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventCreatedAudit,
} from './equipment-events.audit';
import { EquipmentEventsAssertions } from './equipment-events.assertions';

export type CreateManualEquipmentEventCommand = {
  kind: 'manual';
  equipmentVisibleId: number;
  factDate: Date;
  maintenanceTypeId: number;
  note: string | null;
  responsibleEmployeeIds: number[];
};

export type CreatePlannedEquipmentEventCommand = {
  kind: 'planned';
  equipmentVisibleId: number;
  eventTypeId: number;
  originalPlannedDate: Date;
  plannedDate: Date;
  responsibleEmployeeIds: number[];
};

export type CreateEquipmentEventCommand =
  | CreateManualEquipmentEventCommand
  | CreatePlannedEquipmentEventCommand;

@Injectable()
export class EquipmentEventsCreator {
  constructor(
    private readonly assertions: EquipmentEventsAssertions,
    private readonly prisma: PrismaService,
  ) {}

  create(command: CreateEquipmentEventCommand, userId?: string | null) {
    return this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, command, userId),
    );
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    command: CreateEquipmentEventCommand,
    userId?: string | null,
  ) {
    const createdByEmployeeId = await this.assertions.getCurrentEmployeeId(
      tx,
      userId,
    );
    const responsibleEmployeeIds = [
      ...new Set(command.responsibleEmployeeIds),
    ];
    const maintenanceTypeId =
      command.kind === 'manual' ? command.maintenanceTypeId : command.eventTypeId;

    const { equipment, maintenanceSetting } =
      await this.assertions.loadValidEventCreationInput(tx, {
        equipmentVisibleId: command.equipmentVisibleId,
        maintenanceTypeId,
        responsibleEmployeeIds,
      });

    const event = await tx.equipmentEvent.create({
      data: this.toCreateData(command, {
        checklistTemplateId: maintenanceSetting.checklistTemplateId,
        createdByEmployeeId,
        equipmentId: equipment.id,
        executionType: maintenanceSetting.executionType,
        maintenanceSettingId: maintenanceSetting.id,
      }),
    });

    await tx.equipmentEventResponsible.createMany({
      data: responsibleEmployeeIds.map((employeeId) => ({
        employeeId,
        equipmentEventId: event.id,
      })),
    });

    const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, event.id);
    await writeEquipmentEventCreatedAudit(tx, {
      event: auditSnapshot,
      userId,
    });

    return event.id;
  }

  private toCreateData(
    command: CreateEquipmentEventCommand,
    common: {
      checklistTemplateId: number | null;
      createdByEmployeeId: number;
      equipmentId: number;
      executionType: Prisma.EquipmentEventUncheckedCreateInput['executionType'];
      maintenanceSettingId: number;
    },
  ): Prisma.EquipmentEventUncheckedCreateInput {
    if (command.kind === 'manual') {
      return {
        ...common,
        eventTypeId: command.maintenanceTypeId,
        factDate: command.factDate,
        note: command.note,
        originalPlannedDate: null,
        plannedDate: null,
        source: EquipmentEventSource.MANUAL,
        status: EquipmentEventStatus.DRAFT,
      };
    }

    return {
      ...common,
      eventTypeId: command.eventTypeId,
      factDate: null,
      originalPlannedDate: command.originalPlannedDate,
      plannedDate: command.plannedDate,
      source: EquipmentEventSource.PLANNED,
      status: EquipmentEventStatus.CREATED,
    };
  }
}
