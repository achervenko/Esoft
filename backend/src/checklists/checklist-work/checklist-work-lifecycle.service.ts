import { Injectable } from '@nestjs/common';
import { AuditAction, ChecklistStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import { throwChecklistConflict } from '../checklist-common/checklists.errors';
import { ChecklistWorkAssertions } from './checklist-work.assertions';
import { ChecklistWorkQueryService } from './checklist-work-query.service';
import { ChecklistWorkMutationRepository } from './checklist-work.repository';
import type { ChecklistVersionInput } from './checklist-work.types';

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
      this.assertions.assertEventInProgress(event.eventStatus);
      this.assertions.assertVersion(checklist.version, input.version);
      this.assertions.assertChecklistStatus(
        checklist.status,
        ChecklistStatus.CREATED,
      );

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
    input: ChecklistVersionInput,
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

      await tx.$executeRaw`
        UPDATE checklists
        SET
          status = 'COMPLETED',
          completed_at = now(),
          completed_by = ${actorUserId},
          version = version + 1
        WHERE id = ${id}
      `;
      await this.writeStatusAudit(tx, {
        checklistId: id,
        newStatus: ChecklistStatus.COMPLETED,
        oldStatus: checklist.status,
        userId: actorUserId,
      });
    });

    return this.queryService.get(id, { userId: actorUserId });
  }

  writeStatusAudit(
    tx: Prisma.TransactionClient,
    params: {
      checklistId: number;
      newStatus: ChecklistStatus;
      oldStatus: ChecklistStatus;
      userId: string;
    },
  ) {
    return writeChecklistAudit(tx, {
      action: AuditAction.STATUS_CHANGE,
      entityId: params.checklistId,
      entityType: EVENT_CHECKLIST_ENTITY_TYPE,
      fieldName: 'status',
      newValue: params.newStatus,
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
