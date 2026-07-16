import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  throwChecklistBadRequest,
  throwChecklistConflict,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';
import type { TemplateDetailRecord } from './checklist-templates.types';

@Injectable()
export class ChecklistTemplateAssertions {
  assertDraft(template: { id: number; isPublished: boolean }) {
    if (template.isPublished) {
      throwChecklistConflict(
        'CHECKLIST_TEMPLATE_NOT_DRAFT',
        'Опубликованный шаблон нельзя редактировать.',
        { templateId: template.id },
      );
    }
  }

  assertPublishable(template: TemplateDetailRecord) {
    if (!template.name.trim()) {
      throwChecklistConflict('CHECKLIST_TEMPLATE_EMPTY', 'Шаблон пуст.');
    }

    if (template.modules.length === 0) {
      throwChecklistConflict(
        'CHECKLIST_TEMPLATE_EMPTY',
        'Добавьте хотя бы один модуль.',
      );
    }

    this.assertSequential(template.modules.map((module) => module.sortOrder));

    for (const module of template.modules) {
      if (!module.moduleNameSnapshot.trim()) {
        throwChecklistConflict('CHECKLIST_TEMPLATE_EMPTY', 'Модуль шаблона пуст.');
      }

      if (module.questions.length === 0) {
        throwChecklistConflict(
          'CHECKLIST_TEMPLATE_MODULE_EMPTY',
          'В каждом модуле должен быть хотя бы один вопрос.',
        );
      }

      this.assertSequential(module.questions.map((question) => question.sortOrder));
      module.questions.forEach((question) => {
        if (!question.questionTextSnapshot.trim()) {
          throwChecklistConflict(
            'CHECKLIST_TEMPLATE_EMPTY',
            'Вопрос шаблона пуст.',
          );
        }
      });
    }
  }

  assertSequential(values: number[]) {
    const sorted = [...values].sort((left, right) => left - right);
    sorted.forEach((value, index) => {
      if (value !== index + 1) {
        throwChecklistConflict(
          'CHECKLIST_TEMPLATE_ORDER_INVALID',
          'Порядок шаблона нарушен.',
        );
      }
    });
  }

  async assertEquipmentModelExists(tx: Prisma.TransactionClient, id: number) {
    const model = await tx.equipmentModel.findUnique({
      select: { id: true, isActive: true },
      where: { id },
    });

    if (!model) {
      throwChecklistNotFound(
        'EQUIPMENT_MODEL_NOT_FOUND',
        'Модель оборудования не найдена.',
      );
    }

    if (!model.isActive) {
      throwChecklistConflict(
        'EQUIPMENT_MODEL_INACTIVE',
        'Модель оборудования отключена.',
      );
    }
  }

  async assertMaintenanceTypeExists(tx: Prisma.TransactionClient, id: number) {
    const type = await tx.equipmentEventType.findUnique({
      select: { id: true, isActive: true },
      where: { id },
    });

    if (!type) {
      throwChecklistNotFound(
        'MAINTENANCE_TYPE_NOT_FOUND',
        'Вид обслуживания не найден.',
      );
    }

    if (!type.isActive) {
      throwChecklistConflict(
        'MAINTENANCE_TYPE_INACTIVE',
        'Вид обслуживания отключён.',
      );
    }
  }

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
    const question = await tx.checklistQuestion.findUnique({ where: { id } });

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

    return question;
  }

  async loadTemplateModule(
    tx: Prisma.TransactionClient,
    templateId: number,
    templateModuleId: number,
  ) {
    const module = await tx.checklistTemplateModule.findFirst({
      where: { checklistTemplateId: templateId, id: templateModuleId },
    });

    if (!module) {
      throwChecklistNotFound(
        'CHECKLIST_TEMPLATE_MODULE_NOT_FOUND',
        'Модуль шаблона не найден.',
      );
    }

    return module;
  }

  async loadTemplateQuestion(
    tx: Prisma.TransactionClient,
    templateId: number,
    templateQuestionId: number,
  ) {
    const question = await tx.checklistTemplateQuestion.findFirst({
      include: { templateModule: true },
      where: {
        id: templateQuestionId,
        templateModule: { checklistTemplateId: templateId },
      },
    });

    if (!question) {
      throwChecklistNotFound(
        'CHECKLIST_TEMPLATE_QUESTION_NOT_FOUND',
        'Вопрос шаблона не найден.',
      );
    }

    return question;
  }

  assertSameIds(currentIds: number[], nextIds: number[]) {
    const current = [...currentIds].sort((left, right) => left - right);
    const next = [...nextIds].sort((left, right) => left - right);

    if (
      current.length !== next.length ||
      current.some((id, index) => id !== next[index])
    ) {
      throwChecklistBadRequest(
        'CHECKLIST_TEMPLATE_ORDER_INVALID',
        'Переданный порядок не соответствует структуре шаблона.',
      );
    }
  }
}
