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
import { EquipmentEventAccessAssertions } from './equipment-event-access.assertions';
import { EquipmentEventChecklistCreator } from './equipment-event-checklist.creator';
import { EquipmentEventInputLoader } from './equipment-event-input.loader';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventForbidden,
} from './equipment-events.errors';
import { type EquipmentEventChecklistAssignment } from './equipment-events.validation';

export type CreateManualEquipmentEventCommand = {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  kind: 'manual';
  equipmentVisibleId: number;
  maintenanceTypeId: number;
  note: string | null;
  plannedDate: Date;
  responsibleUserIds: string[];
};

export type CreatePlannedEquipmentEventCommand = {
  checklistAssignments: EquipmentEventChecklistAssignment[];
  kind: 'planned';
  equipmentVisibleId: number;
  eventTypeId: number;
  originalPlannedDate: Date;
  plannedDate: Date;
  responsibleUserIds: string[];
};

export type CreateEquipmentEventCommand =
  CreateManualEquipmentEventCommand | CreatePlannedEquipmentEventCommand;

export type CreateEquipmentEventActor =
  | {
      kind: 'user';
      userId?: string | null;
    }
  | {
      employeeId: number;
      kind: 'system';
      userId: string;
    };

@Injectable()
export class EquipmentEventsCreator {
  constructor(
    private readonly accessAssertions: EquipmentEventAccessAssertions,
    private readonly checklistCreator: EquipmentEventChecklistCreator,
    private readonly inputLoader: EquipmentEventInputLoader,
    private readonly prisma: PrismaService,
  ) {}

  create(
    command: CreateEquipmentEventCommand,
    actor: CreateEquipmentEventActor,
  ) {
    return this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, command, actor),
    );
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    command: CreateEquipmentEventCommand,
    actor: CreateEquipmentEventActor,
  ) {
    const creationActor = await this.resolveCreationActor(tx, actor);
    const responsibleUserIds = [...new Set(command.responsibleUserIds)];
    const maintenanceTypeId =
      command.kind === 'manual'
        ? command.maintenanceTypeId
        : command.eventTypeId;

    const { equipment, maintenanceSetting } =
      await this.inputLoader.loadValidEventCreationInput(tx, {
        equipmentVisibleId: command.equipmentVisibleId,
        maintenanceTypeId,
        responsibleUserIds,
      });

    const event = await tx.equipmentEvent.create({
      data: this.toCreateData(command, {
        createdByEmployeeId: creationActor.employeeId,
        equipmentId: equipment.id,
        executionType: maintenanceSetting.executionType,
        maintenanceSettingId: maintenanceSetting.id,
      }),
    });

    await tx.equipmentEventResponsible.createMany({
      data: responsibleUserIds.map((responsibleUserId) => ({
        equipmentEventId: event.id,
        userId: responsibleUserId,
      })),
    });

    await this.checklistCreator.createEventChecklists(tx, {
      assignments: command.checklistAssignments,
      createdBy: creationActor.userId,
      eventId: event.id,
    });

    const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, event.id);
    await writeEquipmentEventCreatedAudit(tx, {
      event: auditSnapshot,
      userId: creationActor.auditUserId,
    });

    return event.id;
  }

  private toCreateData(
    command: CreateEquipmentEventCommand,
    common: {
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
        factDate: null,
        note: command.note,
        originalPlannedDate: command.plannedDate,
        plannedDate: command.plannedDate,
        source: EquipmentEventSource.MANUAL,
        status: EquipmentEventStatus.CREATED,
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

  private async resolveCreationActor(
    tx: Prisma.TransactionClient,
    actor: CreateEquipmentEventActor,
  ) {
    if (actor.kind === 'system') {
      await this.assertSystemActorIsValid(tx, actor);

      return {
        auditUserId: null,
        employeeId: actor.employeeId,
        userId: actor.userId,
      };
    }

    if (!actor.userId) {
      throwEquipmentEventForbidden(
        'SESSION_REQUIRED',
        'Сессия пользователя не найдена.',
      );
    }

    const userId = actor.userId;
    const employeeId = await this.accessAssertions.getCurrentEmployeeId(
      tx,
      userId,
    );

    return {
      auditUserId: userId,
      employeeId,
      userId,
    };
  }

  private async assertSystemActorIsValid(
    tx: Prisma.TransactionClient,
    actor: Extract<CreateEquipmentEventActor, { kind: 'system' }>,
  ) {
    const user = await tx.user.findUnique({
      where: { id: actor.userId },
      select: {
        banned: true,
        employeeUser: {
          select: {
            employeeId: true,
          },
        },
      },
    });

    if (!user) {
      throwEquipmentEventBadRequest(
        'SYSTEM_ACTOR_USER_NOT_FOUND',
        'Технический пользователь для создания события не найден.',
      );
    }

    if (user.banned) {
      throwEquipmentEventForbidden(
        'SYSTEM_ACTOR_USER_INACTIVE',
        'Технический пользователь для создания события отключён.',
      );
    }

    if (user.employeeUser?.employeeId !== actor.employeeId) {
      throwEquipmentEventBadRequest(
        'SYSTEM_ACTOR_EMPLOYEE_MISMATCH',
        'Технический пользователь не связан с указанным сотрудником.',
      );
    }
  }
}
