import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  ChecklistAnswerType,
  ChecklistResult,
  ChecklistStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import {
  throwChecklistBadRequest,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';
import {
  formatDate,
  normalizeDecimal,
  normalizeStoredDecimal,
  parseAnswerValue,
} from './checklist-work-answer.parser';
import { ChecklistWorkAssertions } from './checklist-work.assertions';
import { presentChecklistProgress } from './checklist-work.presenter';
import { ChecklistWorkMutationRepository } from './checklist-work.repository';
import type {
  ChecklistAnswerInput,
  ChecklistAnswersInput,
  ParsedChecklistAnswer,
} from './checklist-work.types';

const EVENT_CHECKLIST_ENTITY_TYPE = 'equipment_event_checklist';

@Injectable()
export class ChecklistWorkAnswersService {
  constructor(
    private readonly assertions: ChecklistWorkAssertions,
    private readonly prisma: PrismaService,
    private readonly mutationRepository: ChecklistWorkMutationRepository,
  ) {}

  async saveAnswers(
    id: number,
    input: ChecklistAnswersInput,
    userId?: string | null,
  ) {
    const actorUserId = this.assertions.requireUserId(userId);

    return this.prisma.$transaction(async (tx) => {
      const { checklist, event } =
        await this.mutationRepository.lockChecklistForMutation(tx, id);

      this.assertions.assertAssigned(checklist.assignedUserId, actorUserId);
      this.assertions.assertEventInProgress(event.eventStatus);
      this.assertions.assertVersion(checklist.version, input.version);
      this.assertions.assertChecklistStatus(
        checklist.status,
        ChecklistStatus.IN_PROGRESS,
      );
      this.assertUniqueAnswerDetails(input.answers);

      const answerRows = await this.mutationRepository.loadAnswerRows(
        tx,
        id,
        input.answers.map((answer) => answer.checklistDetailId),
      );

      if (answerRows.length !== input.answers.length) {
        throwChecklistNotFound(
          'CHECKLIST_QUESTION_NOT_FOUND',
          'Вопрос чек-листа не найден.',
        );
      }

      const answerRowById = new Map(
        answerRows.map((row) => [row.checklistDetailId, row]),
      );
      const parsedAnswers = input.answers.map((answer) =>
        this.parseAnswer(answer, answerRowById.get(answer.checklistDetailId)),
      );
      const changedAnswers = parsedAnswers.filter((answer) =>
        this.hasAnswerChange(
          answer,
          answerRowById.get(answer.checklistDetailId),
        ),
      );
      const hasResultChange =
        input.result !== undefined && input.result !== checklist.result;

      if (changedAnswers.length === 0 && !hasResultChange) {
        const progress = await this.mutationRepository.progress(tx, id);

        return presentChecklistProgress(id, checklist.version, progress);
      }

      for (const answer of changedAnswers) {
        await this.updateAnswer(tx, answer, actorUserId);
      }

      await this.updateDraftResult(tx, id, input.result);

      await tx.$executeRaw`
        UPDATE checklists
        SET version = version + 1
        WHERE id = ${id}
      `;
      await writeChecklistAudit(tx, {
        action: AuditAction.UPDATE,
        entityId: id,
        entityType: EVENT_CHECKLIST_ENTITY_TYPE,
        fieldName: buildAuditFieldName(changedAnswers.length, hasResultChange),
        newValue: JSON.stringify(
          buildAuditValue(changedAnswers.length, hasResultChange, input.result),
        ),
        userId: actorUserId,
      });

      const progress = await this.mutationRepository.progress(tx, id);

      return presentChecklistProgress(id, checklist.version + 1, progress);
    });
  }

  private updateDraftResult(
    tx: Prisma.TransactionClient,
    checklistId: number,
    result: ChecklistResult | null | undefined,
  ) {
    if (result === undefined) {
      return;
    }

    return tx.$executeRaw`
      UPDATE checklists
      SET result = ${result}::checklist_result
      WHERE id = ${checklistId}
    `;
  }

  private parseAnswer(
    answer: ChecklistAnswerInput,
    row:
      | {
          answerType: ChecklistAnswerType;
          checklistDetailId: number;
        }
      | undefined,
  ): ParsedChecklistAnswer {
    if (!row) {
      throwChecklistNotFound(
        'CHECKLIST_QUESTION_NOT_FOUND',
        'Вопрос чек-листа не найден.',
      );
    }

    return {
      checklistDetailId: answer.checklistDetailId,
      value: parseAnswerValue(row.answerType, answer.value),
    };
  }

  private hasAnswerChange(
    answer: ParsedChecklistAnswer,
    row:
      | {
          answerBoolean: boolean | null;
          answerDate: Date | null;
          answerDecimal: Prisma.Decimal | string | null;
          answerInteger: number | null;
          answerText: string | null;
        }
      | undefined,
  ) {
    if (!row) {
      return true;
    }

    switch (answer.value.kind) {
      case 'clear':
        return (
          row.answerBoolean !== null ||
          row.answerInteger !== null ||
          row.answerDecimal !== null ||
          row.answerText !== null ||
          row.answerDate !== null
        );
      case ChecklistAnswerType.BOOLEAN:
        return row.answerBoolean !== answer.value.value;
      case ChecklistAnswerType.INTEGER:
        return row.answerInteger !== answer.value.value;
      case ChecklistAnswerType.DECIMAL:
        return (
          normalizeStoredDecimal(row.answerDecimal) !==
          normalizeDecimal(answer.value.value)
        );
      case ChecklistAnswerType.TEXT:
        return row.answerText !== answer.value.value;
      case ChecklistAnswerType.DATE:
        return formatDate(row.answerDate) !== answer.value.value;
    }
  }

  private updateAnswer(
    tx: Prisma.TransactionClient,
    answer: ParsedChecklistAnswer,
    userId: string,
  ) {
    if (answer.value.kind === 'clear') {
      return tx.$executeRaw`
        UPDATE checklist_details
        SET
          answer_boolean = NULL,
          answer_integer = NULL,
          answer_decimal = NULL,
          answer_text = NULL,
          answer_date = NULL,
          answered_at = NULL,
          answered_by = NULL
        WHERE id = ${answer.checklistDetailId}
      `;
    }

    if (answer.value.kind === ChecklistAnswerType.BOOLEAN) {
      return tx.$executeRaw`
        UPDATE checklist_details
        SET
          answer_boolean = ${answer.value.value},
          answer_integer = NULL,
          answer_decimal = NULL,
          answer_text = NULL,
          answer_date = NULL,
          answered_at = now(),
          answered_by = ${userId}
        WHERE id = ${answer.checklistDetailId}
      `;
    }

    if (answer.value.kind === ChecklistAnswerType.INTEGER) {
      return tx.$executeRaw`
        UPDATE checklist_details
        SET
          answer_boolean = NULL,
          answer_integer = ${answer.value.value},
          answer_decimal = NULL,
          answer_text = NULL,
          answer_date = NULL,
          answered_at = now(),
          answered_by = ${userId}
        WHERE id = ${answer.checklistDetailId}
      `;
    }

    if (answer.value.kind === ChecklistAnswerType.DECIMAL) {
      return tx.$executeRaw`
        UPDATE checklist_details
        SET
          answer_boolean = NULL,
          answer_integer = NULL,
          answer_decimal = ${answer.value.value}::numeric,
          answer_text = NULL,
          answer_date = NULL,
          answered_at = now(),
          answered_by = ${userId}
        WHERE id = ${answer.checklistDetailId}
      `;
    }

    if (answer.value.kind === ChecklistAnswerType.TEXT) {
      return tx.$executeRaw`
        UPDATE checklist_details
        SET
          answer_boolean = NULL,
          answer_integer = NULL,
          answer_decimal = NULL,
          answer_text = ${answer.value.value},
          answer_date = NULL,
          answered_at = ${answer.value.value === null ? null : new Date()},
          answered_by = ${answer.value.value === null ? null : userId}
        WHERE id = ${answer.checklistDetailId}
      `;
    }

    return tx.$executeRaw`
      UPDATE checklist_details
      SET
        answer_boolean = NULL,
        answer_integer = NULL,
        answer_decimal = NULL,
        answer_text = NULL,
        answer_date = ${new Date(`${answer.value.value}T00:00:00.000Z`)},
        answered_at = now(),
        answered_by = ${userId}
      WHERE id = ${answer.checklistDetailId}
    `;
  }

  private assertUniqueAnswerDetails(answers: ChecklistAnswerInput[]) {
    const ids = new Set<number>();

    for (const answer of answers) {
      if (ids.has(answer.checklistDetailId)) {
        throwChecklistBadRequest(
          'CHECKLIST_QUESTION_DUPLICATE',
          'Вопрос чек-листа передан несколько раз.',
        );
      }

      ids.add(answer.checklistDetailId);
    }
  }
}

function buildAuditFieldName(
  changedAnswersCount: number,
  hasResultChange: boolean,
) {
  return [
    changedAnswersCount > 0 ? 'answers' : null,
    hasResultChange ? 'result' : null,
  ]
    .filter((field): field is string => field !== null)
    .join(',');
}

function buildAuditValue(
  changedAnswersCount: number,
  hasResultChange: boolean,
  result: ChecklistResult | null | undefined,
) {
  const auditValue: Record<string, unknown> = {
    answersUpdated: changedAnswersCount,
    resultUpdated: hasResultChange,
  };

  if (hasResultChange) {
    auditValue.result = result;
  }

  return auditValue;
}
