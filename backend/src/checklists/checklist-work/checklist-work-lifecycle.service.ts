import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  ChecklistResult,
  ChecklistStatus,
  EquipmentEventStatus,
  Prisma,
} from '@prisma/client';
import { getBusinessTodayDate } from '../../application/business-date';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventStatusAudit,
  writeEquipmentEventUpdatedAudit,
} from '../../equipment-events/equipment-events.audit';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import { throwChecklistConflict } from '../checklist-common/checklists.errors';
import { ChecklistWorkAssertions } from './checklist-work.assertions';
import { ChecklistWorkQueryService } from './checklist-work-query.service';
import { ChecklistWorkMutationRepository } from './checklist-work.repository';
import type {
  ChecklistCompleteInput,
  ChecklistVersionInput,
} from './checklist-work.types';

const EVENT_CHECKLIST_ENTITY_TYPE = 'equipment_event_checklist';

@Injectable()
export class ChecklistWorkLifecycleService {
  constructor(
    private readonly assertions: ChecklistWorkAssertions,
    private readonly prisma: PrismaService,
    private readonly mutationRepository: ChecklistWorkMutationRepository,
    private readonly queryService: ChecklistWorkQueryService,
  ) {}

  async start(
    id: number,
    input: ChecklistVersionInput,
    userId?: string | null,
  ) {
    const actorUserId = this.assertions.requireUserId(userId);

    await this.prisma.$transaction(async (tx) => {
      const { checklist, event } =
        await this.mutationRepository.lockChecklistForMutation(tx, id);

      this.assertions.assertAssigned(checklist.assignedUserId, actorUserId);
      this.assertions.assertVersion(checklist.version, input.version);
      this.assertions.assertChecklistStatus(
        checklist.status,
        ChecklistStatus.CREATED,
      );
      this.assertions.assertEventCanBeStarted(event.eventStatus);

      if (event.eventStatus === EquipmentEventStatus.CREATED) {
        const [eventChecklists, responsibleUserIds] = await Promise.all([
          this.mutationRepository.lockEventChecklists(
            tx,
            checklist.equipmentEventId,
          ),
          this.mutationRepository.loadResponsibleUserIds(
            tx,
            checklist.equipmentEventId,
          ),
        ]);

        this.assertions.assertStartAssignments({
          checklists: eventChecklists,
          responsibleUserIds,
        });

        const updateEventResult = await tx.equipmentEvent.updateMany({
          where: {
            id: checklist.equipmentEventId,
            status: EquipmentEventStatus.CREATED,
          },
          data: {
            status: EquipmentEventStatus.IN_PROGRESS,
            version: {
              increment: 1,
            },
          },
        });

        if (updateEventResult.count !== 1) {
          throwChecklistConflict(
            'CHECKLIST_EVENT_STATUS_CONFLICT',
            'Событие в текущем статусе нельзя начать через чек-лист.',
          );
        }

        await tx.$executeRaw`
          UPDATE checklists
          SET
            status = 'IN_PROGRESS',
            started_at = now(),
            started_by = ${actorUserId},
            version = version + 1
          WHERE id = ${id}
        `;

        const auditSnapshot = await getEquipmentEventAuditSnapshot(
          tx,
          checklist.equipmentEventId,
        );
        await writeEquipmentEventStatusAudit(tx, {
          event: auditSnapshot,
          newStatus: EquipmentEventStatus.IN_PROGRESS,
          oldStatus: event.eventStatus,
          userId: actorUserId,
        });
        await this.writeStatusAudit(tx, {
          checklistId: id,
          newStatus: ChecklistStatus.IN_PROGRESS,
          oldStatus: checklist.status,
          userId: actorUserId,
        });

        return;
      }

      await tx.$executeRaw`
        UPDATE checklists
        SET
          status = 'IN_PROGRESS',
          started_at = now(),
          started_by = ${actorUserId},
          version = version + 1
        WHERE id = ${id}
      `;
      await this.writeStatusAudit(tx, {
        checklistId: id,
        newStatus: ChecklistStatus.IN_PROGRESS,
        oldStatus: checklist.status,
        userId: actorUserId,
      });
    });

    return this.queryService.get(id, { userId: actorUserId });
  }

  async complete(
    id: number,
    input: ChecklistCompleteInput,
    userId?: string | null,
  ) {
    const actorUserId = this.assertions.requireUserId(userId);

    await this.prisma.$transaction(async (tx) => {
      const { checklist, event } =
        await this.mutationRepository.lockChecklistForMutation(tx, id);

      this.assertions.assertAssigned(checklist.assignedUserId, actorUserId);
      this.assertions.assertEventInProgress(event.eventStatus);
      this.assertions.assertVersion(checklist.version, input.version);
      this.assertions.assertChecklistStatus(
        checklist.status,
        ChecklistStatus.IN_PROGRESS,
      );
      await this.assertRequiredAnswersCompleted(tx, id);
      const completedDate = getBusinessTodayDate();

      await tx.$executeRaw`
        UPDATE checklists
        SET
          status = 'COMPLETED',
          result = ${input.result}::checklist_result,
          checklist_date = ${completedDate},
          completed_at = now(),
          completed_by = ${actorUserId},
          version = version + 1
        WHERE id = ${id}
      `;
      await this.writeStatusAudit(tx, {
        checklistId: id,
        newStatus: ChecklistStatus.COMPLETED,
        oldStatus: checklist.status,
        result: input.result,
        userId: actorUserId,
      });

      const eventChecklists = await this.mutationRepository.lockEventChecklists(
        tx,
        checklist.equipmentEventId,
      );

      if (
        eventChecklists.length > 0 &&
        eventChecklists.every(
          (eventChecklist) =>
            eventChecklist.status === ChecklistStatus.COMPLETED,
        )
      ) {
        const previousAuditSnapshot = await getEquipmentEventAuditSnapshot(
          tx,
          checklist.equipmentEventId,
        );
        const nextFactDate = event.factDate ?? getBusinessTodayDate();

        const updateEventResult = await tx.equipmentEvent.updateMany({
          where: {
            id: checklist.equipmentEventId,
            status: EquipmentEventStatus.IN_PROGRESS,
          },
          data: {
            factDate: nextFactDate,
            status: EquipmentEventStatus.COMPLETED,
            version: {
              increment: 1,
            },
          },
        });

        if (updateEventResult.count !== 1) {
          throwChecklistConflict(
            'CHECKLIST_EVENT_STATUS_CONFLICT',
            'Событие в текущем статусе нельзя завершить через чек-лист.',
          );
        }

        const auditSnapshot = await getEquipmentEventAuditSnapshot(
          tx,
          checklist.equipmentEventId,
        );
        await writeEquipmentEventStatusAudit(tx, {
          event: auditSnapshot,
          newStatus: EquipmentEventStatus.COMPLETED,
          oldStatus: event.eventStatus,
          userId: actorUserId,
        });

        if (
          previousAuditSnapshot.factDate?.toISOString() !==
          auditSnapshot.factDate?.toISOString()
        ) {
          await writeEquipmentEventUpdatedAudit(tx, {
            newEvent: auditSnapshot,
            oldEvent: previousAuditSnapshot,
            userId: actorUserId,
          });
        }
      }
    });

    return this.queryService.get(id, { userId: actorUserId });
  }

  writeStatusAudit(
    tx: Prisma.TransactionClient,
    params: {
      checklistId: number;
      newStatus: ChecklistStatus;
      oldStatus: ChecklistStatus;
      result?: ChecklistResult;
      userId: string;
    },
  ) {
    return writeChecklistAudit(tx, {
      action: AuditAction.STATUS_CHANGE,
      entityId: params.checklistId,
      entityType: EVENT_CHECKLIST_ENTITY_TYPE,
      fieldName: 'status',
      newValue:
        params.result === undefined
          ? params.newStatus
          : JSON.stringify({
              result: params.result,
              status: params.newStatus,
            }),
      oldValue: params.oldStatus,
      userId: params.userId,
    });
  }

  private async assertRequiredAnswersCompleted(
    tx: Prisma.TransactionClient,
    checklistId: number,
  ) {
    const [state] = await tx.$queryRaw<Array<{ hasMissing: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM checklist_details
        WHERE checklist_id = ${checklistId}
          AND is_required IS TRUE
          AND answer_boolean IS NULL
          AND answer_integer IS NULL
          AND answer_decimal IS NULL
          AND answer_text IS NULL
          AND answer_date IS NULL
      ) AS "hasMissing"
    `;

    if (state?.hasMissing) {
      throwChecklistConflict(
        'CHECKLIST_REQUIRED_ANSWERS_MISSING',
        'Заполните обязательные вопросы чек-листа.',
      );
    }
  }
}
