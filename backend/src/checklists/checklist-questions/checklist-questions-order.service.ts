import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const TEMP_SORT_ORDER_OFFSET = 1_000_000;

@Injectable()
export class ChecklistQuestionsOrderService {
  async getNextActiveQuestionSortOrder(
    tx: Prisma.TransactionClient,
    checklistModuleId: number,
  ) {
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

    const questions = await tx.checklistQuestion.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
      where: { checklistModuleId, isActive: true },
    });

    await this.applyTemporarySortOrder(
      tx,
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
    questionIds: number[],
    userId: string,
  ) {
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
