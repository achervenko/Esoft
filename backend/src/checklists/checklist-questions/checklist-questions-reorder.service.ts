import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import { throwChecklistPrismaError } from '../checklist-common/checklists.errors';
import { ChecklistQuestionsAssertions } from './checklist-questions.assertions';
import { ChecklistQuestionsOrderService } from './checklist-questions-order.service';
import { presentQuestion } from './checklist-questions.presenter';
import { checklistQuestionInclude } from './checklist-questions.select';
import type { QuestionReorderInput } from './checklist-questions.types';

@Injectable()
export class ChecklistQuestionsReorderService {
  constructor(
    private readonly assertions: ChecklistQuestionsAssertions,
    private readonly orderService: ChecklistQuestionsOrderService,
    private readonly prisma: PrismaService,
  ) {}

  async reorder(moduleId: number, input: QuestionReorderInput, userId: string) {
    try {
      const questions = await this.prisma.$transaction(async (tx) => {
        await this.assertions.assertModuleExists(tx, moduleId);

        const current = await this.findActiveQuestionsByModule(tx, moduleId);
        this.assertions.assertFullActiveQuestionOrder(current, input.items);

        await this.orderService.applyTemporarySortOrder(
          tx,
          input.items.map((item) => item.id),
          userId,
        );

        await Promise.all(
          input.items.map((item) =>
            tx.checklistQuestion.update({
              data: { sortOrder: item.sortOrder, updatedBy: userId },
              where: { id: item.id },
            }),
          ),
        );

        const updated = await this.findActiveQuestionsByModule(tx, moduleId);

        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: moduleId,
          entityType: 'checklist_question',
          fieldName: 'CHECKLIST_QUESTION_ORDER_UPDATED',
          newValue: updated.map(({ id, sortOrder }) => ({ id, sortOrder })),
          oldValue: current.map(({ id, sortOrder }) => ({ id, sortOrder })),
          userId,
        });

        return updated;
      });

      return { questions: questions.map(presentQuestion) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  private findActiveQuestionsByModule(
    tx: Prisma.TransactionClient,
    moduleId: number,
  ) {
    return tx.checklistQuestion.findMany({
      include: checklistQuestionInclude,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      where: { checklistModuleId: moduleId, isActive: true },
    });
  }
}
