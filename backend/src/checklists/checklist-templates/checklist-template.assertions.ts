import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  throwChecklistConflict,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';

@Injectable()
export class ChecklistTemplateAssertions {
  async loadActiveModule(tx: Prisma.TransactionClient, id: number) {
    const module = await tx.checklistModule.findUnique({ where: { id } });

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

    return module;
  }

  async loadActiveQuestion(tx: Prisma.TransactionClient, id: number) {
    const question = await tx.checklistQuestion.findUnique({
      include: { module: true },
      where: { id },
    });

    if (!question) {
      throwChecklistNotFound(
        'CHECKLIST_QUESTION_NOT_FOUND',
        'Вопрос чек-листа не найден.',
      );
    }

    if (!question.isActive) {
      throwChecklistConflict(
        'CHECKLIST_QUESTION_INACTIVE',
        'Вопрос чек-листа отключён.',
      );
    }

    if (!question.module?.isActive) {
      throwChecklistConflict(
        'CHECKLIST_MODULE_INACTIVE',
        'Назначьте вопрос активному модулю чек-листа.',
      );
    }

    return question;
  }
}
