import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import {
  throwChecklistConflict,
  throwChecklistPrismaError,
} from '../checklist-common/checklists.errors';
import { ChecklistQuestionsAssertions } from './checklist-questions.assertions';
import { ChecklistQuestionsOrderLockService } from './checklist-questions-order-lock.service';
import { ChecklistQuestionsOrderService } from './checklist-questions-order.service';
import { presentQuestion } from './checklist-questions.presenter';
import { checklistQuestionInclude } from './checklist-questions.select';
import type { ChecklistQuestionRecord } from './checklist-questions.types';

@Injectable()
export class ChecklistQuestionsStatusService {
  constructor(
    private readonly assertions: ChecklistQuestionsAssertions,
    private readonly orderLock: ChecklistQuestionsOrderLockService,
    private readonly orderService: ChecklistQuestionsOrderService,
    private readonly prisma: PrismaService,
  ) {}

  activate(id: number, userId: string) {
    return this.setActive(id, true, userId);
  }

  deactivate(id: number, userId: string) {
    return this.setActive(id, false, userId);
  }

  private async setActive(id: number, isActive: boolean, userId: string) {
    try {
      const question = await this.prisma.$transaction(async (tx) => {
        const orderContext = await this.assertions.loadQuestionOrderContext(
          id,
          tx,
        );

        await this.orderLock.lock(tx, orderContext.checklistModuleId);

        const current = await this.assertions.loadQuestionForMutation(id, tx);

        if (current.checklistModuleId !== orderContext.checklistModuleId) {
          throwChecklistConflict(
            'CHECKLIST_QUESTION_VERSION_CONFLICT',
            'Вопрос был изменён другим пользователем.',
          );
        }

        if (current.isActive === isActive) {
          throwChecklistConflict(
            isActive
              ? 'CHECKLIST_QUESTION_ALREADY_ACTIVE'
              : 'CHECKLIST_QUESTION_ALREADY_INACTIVE',
            isActive ? 'Вопрос уже активен.' : 'Вопрос уже отключён.',
          );
        }

        const updated = await tx.checklistQuestion.update({
          data: {
            isActive,
            ...(isActive
              ? await this.getQuestionActivationData(tx, current)
              : { sortOrder: null }),
            updatedBy: userId,
          },
          include: checklistQuestionInclude,
          where: { id },
        });

        if (!isActive) {
          await this.orderService.normalizeActiveQuestionOrder(
            tx,
            current.checklistModuleId,
            userId,
          );
        }

        await writeChecklistAudit(tx, {
          action: AuditAction.STATUS_CHANGE,
          entityId: id,
          entityType: 'checklist_question',
          fieldName: isActive
            ? 'CHECKLIST_QUESTION_ACTIVATED'
            : 'CHECKLIST_QUESTION_DEACTIVATED',
          newValue: presentQuestion(updated),
          oldValue: presentQuestion(current),
          userId,
        });

        return updated;
      });

      return { question: presentQuestion(question) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  private async getQuestionActivationData(
    tx: Prisma.TransactionClient,
    current: ChecklistQuestionRecord,
  ): Promise<Prisma.ChecklistQuestionUncheckedUpdateInput> {
    if (current.checklistModuleId === null) {
      return { sortOrder: null };
    }

    if (!current.module?.isActive) {
      throwChecklistConflict(
        'CHECKLIST_MODULE_INACTIVE',
        'Модуль чек-листа отключён.',
      );
    }

    return {
      sortOrder: await this.orderService.getNextActiveQuestionSortOrder(
        tx,
        current.checklistModuleId,
      ),
    };
  }
}
