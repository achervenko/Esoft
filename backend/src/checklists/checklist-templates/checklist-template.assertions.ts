import { Injectable } from '@nestjs/common';
import { ChecklistAnswerType, Prisma } from '@prisma/client';
import {
  throwChecklistConflict,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';

@Injectable()
export class ChecklistTemplateAssertions {
  async loadActiveModule(tx: Prisma.TransactionClient, id: number) {
    const modules = await tx.$queryRaw<
      Array<{
        description: string | null;
        id: number;
        isActive: boolean;
        name: string;
        sortOrder: number;
      }>
    >`
      SELECT
        description,
        id,
        is_active AS "isActive",
        name,
        sort_order AS "sortOrder"
      FROM checklist_modules
      WHERE id = ${id}
      FOR SHARE
    `;
    const module = modules[0];

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
    const questions = await tx.$queryRaw<
      Array<{
        answerType: ChecklistAnswerType;
        checklistModuleId: number | null;
        id: number;
        isActive: boolean;
        moduleId: number | null;
        moduleIsActive: boolean | null;
        moduleName: string | null;
        questionText: string;
        sortOrder: number | null;
      }>
    >`
      SELECT
        question.answer_type AS "answerType",
        question.checklist_module_id AS "checklistModuleId",
        question.id,
        question.is_active AS "isActive",
        module.id AS "moduleId",
        module.is_active AS "moduleIsActive",
        module.name AS "moduleName",
        question.question_text AS "questionText",
        question.sort_order AS "sortOrder"
      FROM checklist_questions question
      JOIN checklist_modules module
        ON module.id = question.checklist_module_id
      WHERE question.id = ${id}
      FOR SHARE OF question, module
    `;
    const row = questions[0];

    if (!row) {
      throwChecklistNotFound(
        'CHECKLIST_QUESTION_NOT_FOUND',
        'Вопрос чек-листа не найден.',
      );
    }

    if (!row.isActive) {
      throwChecklistConflict(
        'CHECKLIST_QUESTION_INACTIVE',
        'Вопрос чек-листа отключён.',
      );
    }

    if (!row.moduleIsActive) {
      throwChecklistConflict(
        'CHECKLIST_MODULE_INACTIVE',
        'Назначьте вопрос активному модулю чек-листа.',
      );
    }

    return {
      answerType: row.answerType,
      checklistModuleId: row.checklistModuleId,
      id: row.id,
      isActive: row.isActive,
      module: row.moduleId
        ? {
            id: row.moduleId,
            isActive: row.moduleIsActive,
            name: row.moduleName,
          }
        : null,
      questionText: row.questionText,
      sortOrder: row.sortOrder,
    };
  }
}
