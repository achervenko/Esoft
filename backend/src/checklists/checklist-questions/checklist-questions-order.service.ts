import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ChecklistQuestionsOrderLockService } from './checklist-questions-order-lock.service';

const TEMP_SORT_ORDER_OFFSET = 1_000_000;

@Injectable()
export class ChecklistQuestionsOrderService {
  constructor(private readonly orderLock: ChecklistQuestionsOrderLockService) {}

  async getNextActiveQuestionSortOrder(
    tx: Prisma.TransactionClient,
    checklistModuleId: number,
  ) {
    await this.orderLock.lock(tx, checklistModuleId);

    const aggregate = await tx.checklistQuestion.aggregate({
      _max: { sortOrder: true },
      where: { checklistModuleId, isActive: true },
    });

    return (aggregate._max.sortOrder ?? 0) + 1;
  }

  async normalizeActiveQuestionOrder(
    tx: Prisma.TransactionClient,
    checklistModuleId: number | null,
    userId: string,
  ) {
    if (checklistModuleId === null) {
      return;
    }

    await this.orderLock.lock(tx, checklistModuleId);

    const questions = await tx.checklistQuestion.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true, sortOrder: true },
      where: { checklistModuleId, isActive: true },
    });

    const needsNormalization = questions.some(
      (question, index) => question.sortOrder !== index + 1,
    );

    if (!needsNormalization) {
      return;
    }

    await this.applyTemporarySortOrder(
      tx,
      checklistModuleId,
      questions.map((question) => question.id),
      userId,
    );

    await Promise.all(
      questions.map((question, index) =>
        tx.checklistQuestion.update({
          data: { sortOrder: index + 1, updatedBy: userId },
          where: { id: question.id },
        }),
      ),
    );
  }

  async applyTemporarySortOrder(
    tx: Prisma.TransactionClient,
    checklistModuleId: number,
    questionIds: number[],
    userId: string,
  ) {
    await this.orderLock.lock(tx, checklistModuleId);

    await Promise.all(
      questionIds.map((questionId, index) =>
        tx.checklistQuestion.update({
          data: {
            sortOrder: TEMP_SORT_ORDER_OFFSET + index + 1,
            updatedBy: userId,
          },
          where: { id: questionId },
        }),
      ),
    );
  }
}
