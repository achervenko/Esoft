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
import { ChecklistQuestionsReorderService } from './checklist-questions-reorder.service';
import { checklistQuestionInclude } from './checklist-questions.select';
import { ChecklistQuestionsStatusService } from './checklist-questions-status.service';
import type {
  ChecklistQuestionRecord,
  QuestionInput,
  QuestionQuery,
  QuestionReorderInput,
  QuestionUpdateInput,
} from './checklist-questions.types';

@Injectable()
export class ChecklistQuestionsService {
  constructor(
    private readonly assertions: ChecklistQuestionsAssertions,
    private readonly orderLock: ChecklistQuestionsOrderLockService,
    private readonly orderService: ChecklistQuestionsOrderService,
    private readonly prisma: PrismaService,
    private readonly reorderService: ChecklistQuestionsReorderService,
    private readonly statusService: ChecklistQuestionsStatusService,
  ) {}

  async list(query: QuestionQuery) {
    const where: Prisma.ChecklistQuestionWhereInput = {
      answerType: query.answerType,
      checklistModuleId: query.checklistModuleId,
      isActive: query.isActive,
      OR: query.search
        ? [
            { questionText: { contains: query.search, mode: 'insensitive' } },
            {
              module: {
                name: { contains: query.search, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.checklistQuestion.findMany({
        include: checklistQuestionInclude,
        orderBy:
          query.checklistModuleId === null
            ? [{ createdAt: 'desc' }, { id: 'desc' }]
            : [{ [query.sortBy]: query.sortDirection }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        where,
      }),
      this.prisma.checklistQuestion.count({ where }),
    ]);

    return {
      items: items.map(presentQuestion),
      limit: query.limit,
      page: query.page,
      total,
    };
  }

  async get(id: number) {
    return {
      question: presentQuestion(await this.assertions.loadQuestion(id)),
    };
  }

  async create(input: QuestionInput, userId: string) {
    try {
      const question = await this.prisma.$transaction(async (tx) => {
        if (input.checklistModuleId !== null) {
          await this.orderLock.lock(tx, input.checklistModuleId);
          await this.assertions.assertActiveModule(tx, input.checklistModuleId);
        }

        const created = await tx.checklistQuestion.create({
          data: {
            answerType: input.answerType,
            checklistModuleId: input.checklistModuleId,
            createdBy: userId,
            isActive: true,
            questionText: input.questionText,
            sortOrder:
              input.checklistModuleId === null
                ? null
                : await this.orderService.getNextActiveQuestionSortOrder(
                    tx,
                    input.checklistModuleId,
                  ),
            updatedBy: userId,
          },
          include: checklistQuestionInclude,
        });

        await writeChecklistAudit(tx, {
          action: AuditAction.CREATE,
          entityId: created.id,
          entityType: 'checklist_question',
          fieldName: 'CHECKLIST_QUESTION_CREATED',
          newValue: presentQuestion(created),
          userId,
        });

        return created;
      });

      return { question: presentQuestion(question) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async update(id: number, input: QuestionUpdateInput, userId: string) {
    try {
      const question = await this.prisma.$transaction(async (tx) => {
        const checklistModuleId = input.checklistModuleId;
        const orderContext =
          checklistModuleId === undefined
            ? null
            : await this.assertions.loadQuestionOrderContext(id, tx);

        if (checklistModuleId !== undefined) {
          await this.orderLock.lockMany(tx, [
            orderContext?.checklistModuleId,
            checklistModuleId,
          ]);
        }

        const current = await this.assertions.loadQuestionForMutation(id, tx);

        if (
          orderContext &&
          current.checklistModuleId !== orderContext.checklistModuleId
        ) {
          throwChecklistConflict(
            'CHECKLIST_QUESTION_VERSION_CONFLICT',
            'Вопрос был изменён другим пользователем.',
          );
        }

        if (!hasQuestionChanges(current, input)) {
          return current;
        }

        if (checklistModuleId !== undefined && checklistModuleId !== null) {
          await this.assertions.assertActiveModule(tx, checklistModuleId);
        }

        const isModuleChanged =
          checklistModuleId !== undefined &&
          checklistModuleId !== current.checklistModuleId;
        const updated = await tx.checklistQuestion.update({
          data: {
            ...('answerType' in input ? { answerType: input.answerType } : {}),
            ...(checklistModuleId !== undefined
              ? {
                  checklistModuleId,
                  ...(isModuleChanged
                    ? await this.getModuleChangeSortOrderData(
                        tx,
                        checklistModuleId,
                        current.isActive,
                      )
                    : {}),
                }
              : {}),
            ...('questionText' in input
              ? { questionText: input.questionText }
              : {}),
            updatedBy: userId,
          },
          include: checklistQuestionInclude,
          where: { id },
        });

        if (isModuleChanged) {
          await this.orderService.normalizeActiveQuestionOrder(
            tx,
            current.checklistModuleId,
            userId,
          );
        }

        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: id,
          entityType: 'checklist_question',
          fieldName: 'CHECKLIST_QUESTION_UPDATED',
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

  activate(id: number, userId: string) {
    return this.statusService.activate(id, userId);
  }

  deactivate(id: number, userId: string) {
    return this.statusService.deactivate(id, userId);
  }

  reorder(moduleId: number, input: QuestionReorderInput, userId: string) {
    return this.reorderService.reorder(moduleId, input, userId);
  }

  private async getModuleChangeSortOrderData(
    tx: Prisma.TransactionClient,
    checklistModuleId: number | null,
    isActive: boolean,
  ): Promise<Pick<Prisma.ChecklistQuestionUncheckedUpdateInput, 'sortOrder'>> {
    return checklistModuleId === null || !isActive
      ? { sortOrder: null }
      : {
          sortOrder: await this.orderService.getNextActiveQuestionSortOrder(
            tx,
            checklistModuleId,
          ),
        };
  }
}

function hasQuestionChanges(
  current: ChecklistQuestionRecord,
  input: QuestionUpdateInput,
) {
  return (
    ('answerType' in input && current.answerType !== input.answerType) ||
    ('checklistModuleId' in input &&
      current.checklistModuleId !== input.checklistModuleId) ||
    ('questionText' in input && current.questionText !== input.questionText)
  );
}
