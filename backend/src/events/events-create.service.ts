import { Injectable } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getEventAuditSnapshot, writeEventCreatedAudit } from './events.audit';
import { EventsAccessAssertions } from './events-access.assertions';
import { throwEventBadRequest } from './events.errors';
import type {
  CreateEventActor,
  CreateEventCommand,
  EventCreateOptions,
  ResolvedCreateEventActor,
} from './events-create.types';

@Injectable()
export class EventsCreateService {
  constructor(
    private readonly accessAssertions: EventsAccessAssertions,
    private readonly prisma: PrismaService,
  ) {}

  create(
    command: CreateEventCommand,
    actor: CreateEventActor,
    options: EventCreateOptions = {},
  ): Promise<number> {
    return this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, command, actor, options),
    );
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    command: CreateEventCommand,
    actor: CreateEventActor,
    options: EventCreateOptions = {},
  ): Promise<number> {
    this.assertCreateOptionsMatchCommand(command, options);

    const creationActor = await this.resolveCreationActor(tx, actor);
    const responsibleUserIds = [...new Set(command.responsibleUserIds)];

    await this.accessAssertions.assertResponsibleUsersExist(
      tx,
      responsibleUserIds,
    );

    const event = await tx.event.create({
      data: {
        createdByEmployeeId: creationActor.employeeId,
        extensionCode: command.extensionCode,
        factDate: null,
        note: command.note,
        originalPlannedDate: command.originalPlannedDate,
        plannedDate: command.plannedDate,
        source: command.source,
        status: EventStatus.CREATED,
        title: command.title,
      },
      select: {
        id: true,
      },
    });

    await options.createExtension?.({
      eventId: event.id,
      tx,
    });

    if (responsibleUserIds.length > 0) {
      await tx.eventResponsible.createMany({
        data: responsibleUserIds.map((responsibleUserId) => ({
          eventId: event.id,
          userId: responsibleUserId,
        })),
      });
    }

    if (command.checklistAssignments.length > 0) {
      await options.createChecklists?.({
        assignments: command.checklistAssignments,
        createdBy: creationActor.userId,
        eventId: event.id,
        tx,
      });
    }

    const auditSnapshot = await getEventAuditSnapshot(tx, event.id);
    await writeEventCreatedAudit(tx, {
      event: auditSnapshot,
      userId: creationActor.auditUserId,
    });

    return event.id;
  }

  private async resolveCreationActor(
    tx: Prisma.TransactionClient,
    actor: CreateEventActor,
  ): Promise<ResolvedCreateEventActor> {
    if (actor.kind === 'system') {
      await this.assertSystemActorIsValid(tx, actor);

      return {
        auditUserId: null,
        employeeId: actor.employeeId,
        userId: actor.userId,
      };
    }

    const employeeId = await this.accessAssertions.getCurrentEmployeeId(
      tx,
      actor.userId,
    );

    return {
      auditUserId: actor.userId,
      employeeId,
      userId: actor.userId,
    };
  }

  private assertCreateOptionsMatchCommand(
    command: CreateEventCommand,
    options: EventCreateOptions,
  ): void {
    if (command.extensionCode === null && options.createExtension) {
      throwEventBadRequest(
        'EVENT_EXTENSION_UNEXPECTED',
        'Для события без типа расширения нельзя создавать данные расширения.',
      );
    }

    if (command.extensionCode !== null && !options.createExtension) {
      throwEventBadRequest(
        'EVENT_EXTENSION_REQUIRED',
        'Для события с типом расширения необходимо создать данные расширения.',
      );
    }

    if (command.checklistAssignments.length > 0 && !options.createChecklists) {
      throwEventBadRequest(
        'EVENT_CHECKLIST_CREATOR_REQUIRED',
        'Для создания назначенных чек-листов не задан обработчик.',
      );
    }
  }

  private async assertSystemActorIsValid(
    tx: Prisma.TransactionClient,
    actor: Extract<CreateEventActor, { kind: 'system' }>,
  ): Promise<void> {
    const employeeId = await this.accessAssertions.getCurrentEmployeeId(
      tx,
      actor.userId,
    );

    if (employeeId !== actor.employeeId) {
      throwEventBadRequest(
        'SYSTEM_ACTOR_EMPLOYEE_MISMATCH',
        'Технический пользователь не связан с указанным сотрудником.',
      );
    }
  }
}
