import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import {
  throwChecklistConflict,
  throwChecklistNotFound,
  throwChecklistPrismaError,
} from '../checklist-common/checklists.errors';
import type {
  parseChecklistQuestionPayload,
  parseChecklistQuestionUpdatePayload,
  parseChecklistQuestionsQuery,
} from './checklist-questions.validation';

type QuestionInput = ReturnType<typeof parseChecklistQuestionPayload>;
type QuestionUpdateInput = ReturnType<typeof parseChecklistQuestionUpdatePayload>;
type QuestionQuery = ReturnType<typeof parseChecklistQuestionsQuery>;

@Injectable()
export class ChecklistQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QuestionQuery) {
    const where: Prisma.ChecklistQuestionWhereInput = {
      answerType: query.answerType,
      checklistModuleId: query.moduleId,
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
        include: { module: { select: moduleSummarySelect } },
        orderBy: [{ [query.sortBy]: query.sortDirection }, { id: 'asc' }],
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
    return { question: presentQuestion(await this.loadQuestion(id)) };
  }

  async create(input: QuestionInput, userId: string) {
    try {
      const question = await this.prisma.$transaction(async (tx) => {
        await this.assertActiveModule(tx, input.checklistModuleId);
        const created = await tx.checklistQuestion.create({
          data: {
            answerType: input.answerType,
            checklistModuleId: input.checklistModuleId,
            createdBy: userId,
            isActive: true,
            questionText: input.questionText,
            updatedBy: userId,
          },
          include: { module: { select: moduleSummarySelect } },
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
        const current = await this.loadQuestion(id, tx);
        const checklistModuleId = input.checklistModuleId;
        if (checklistModuleId !== undefined) {
          await this.assertActiveModule(tx, checklistModuleId);
        }
        const updated = await tx.checklistQuestion.update({
          data: {
            ...('answerType' in input ? { answerType: input.answerType } : {}),
            ...(checklistModuleId !== undefined ? { checklistModuleId } : {}),
            ...('questionText' in input
              ? { questionText: input.questionText }
              : {}),
            updatedBy: userId,
          },
          include: { module: { select: moduleSummarySelect } },
          where: { id },
        });

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
    return this.setActive(id, true, userId);
  }

  deactivate(id: number, userId: string) {
    return this.setActive(id, false, userId);
  }

  private async setActive(id: number, isActive: boolean, userId: string) {
    try {
      const question = await this.prisma.$transaction(async (tx) => {
        const current = await this.loadQuestion(id, tx);

        if (current.isActive === isActive) {
          throwChecklistConflict(
            isActive
              ? 'CHECKLIST_QUESTION_ALREADY_ACTIVE'
              : 'CHECKLIST_QUESTION_ALREADY_INACTIVE',
            isActive ? 'Вопрос уже активен.' : 'Вопрос уже отключён.',
          );
        }

        const updated = await tx.checklistQuestion.update({
          data: { isActive, updatedBy: userId },
          include: { module: { select: moduleSummarySelect } },
          where: { id },
        });

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

  private async assertActiveModule(tx: Prisma.TransactionClient, id: number) {
    const module = await tx.checklistModule.findUnique({
      select: { id: true, isActive: true },
      where: { id },
    });

    if (!module) {
      throwChecklistNotFound(
        'CHECKLIST_MODULE_NOT_FOUND',
        'Модуль чек-листа не найден.',
      );
    }

    if (!module.isActive) {
      throwChecklistConflict(
        'CHECKLIST_MODULE_INACTIVE',
        'Модуль чек-листа отключён.',
      );
    }
  }

  private async loadQuestion(
    id: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const question = await tx.checklistQuestion.findUnique({
      include: { module: { select: moduleSummarySelect } },
      where: { id },
    });

    if (!question) {
      throwChecklistNotFound(
        'CHECKLIST_QUESTION_NOT_FOUND',
        'Вопрос чек-листа не найден.',
      );
    }

    return question;
  }
}

const moduleSummarySelect = {
  id: true,
  name: true,
} as const;

function presentQuestion(
  question: Prisma.ChecklistQuestionGetPayload<{
    include: { module: { select: typeof moduleSummarySelect } };
  }>,
) {
  return {
    answerType: question.answerType,
    createdAt: question.createdAt,
    id: question.id,
    isActive: question.isActive,
    module: question.module,
    questionText: question.questionText,
    updatedAt: question.updatedAt,
  };
}
