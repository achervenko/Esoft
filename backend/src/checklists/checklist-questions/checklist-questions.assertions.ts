import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  throwChecklistConflict,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';
import { checklistQuestionInclude } from './checklist-questions.select';
import type {
  ChecklistQuestionRecord,
  QuestionReorderInput,
} from './checklist-questions.types';

@Injectable()
export class ChecklistQuestionsAssertions {
  constructor(private readonly prisma: PrismaService) {}

  async loadQuestion(id: number, tx: Prisma.TransactionClient = this.prisma) {
    const question = await tx.checklistQuestion.findUnique({
      include: checklistQuestionInclude,
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

  async loadQuestionForMutation(id: number, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM checklist_questions
      WHERE id = ${id}
      FOR UPDATE
    `;

    if (!rows[0]) {
      throwChecklistNotFound(
        'CHECKLIST_QUESTION_NOT_FOUND',
        'Вопрос чек-листа не найден.',
      );
    }

    return this.loadQuestion(id, tx);
  }

  async loadQuestionOrderContext(id: number, tx: Prisma.TransactionClient) {
    const question = await tx.checklistQuestion.findUnique({
      select: { checklistModuleId: true, id: true },
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

  async assertActiveModule(tx: Prisma.TransactionClient, id: number) {
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

  async assertModuleExists(tx: Prisma.TransactionClient, id: number) {
    const module = await tx.checklistModule.findUnique({
      select: { id: true },
      where: { id },
    });

    if (!module) {
      throwChecklistNotFound(
        'CHECKLIST_MODULE_NOT_FOUND',
        'Модуль чек-листа не найден.',
      );
    }
  }

  assertFullActiveQuestionOrder(
    current: ChecklistQuestionRecord[],
    items: QuestionReorderInput['items'],
  ) {
    const currentIds = current
      .map((question) => question.id)
      .sort((left, right) => left - right);
    const payloadIds = items
      .map((item) => item.id)
      .sort((left, right) => left - right);

    if (
      currentIds.length !== payloadIds.length ||
      currentIds.some((id, index) => id !== payloadIds[index])
    ) {
      throwChecklistConflict(
        'CHECKLIST_QUESTION_ORDER_SET_MISMATCH',
        'Передайте полный актуальный список активных вопросов модуля.',
      );
    }
  }
}
