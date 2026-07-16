import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import {
  throwChecklistConflict,
  throwChecklistPrismaError,
} from '../checklist-common/checklists.errors';
import { presentTemplateDetail } from './checklist-templates.presenter';
import type {
  AddModuleInput,
  AddQuestionInput,
  TemplateMutationVersionInput,
  UpdateQuestionInput,
} from './checklist-templates.types';
import { ChecklistTemplateAssertions } from './checklist-template.assertions';
import { ChecklistTemplateOrderService } from './checklist-template-order.service';
import { ChecklistTemplateRepository } from './checklist-template.repository';

@Injectable()
export class ChecklistTemplateStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: ChecklistTemplateAssertions,
    private readonly orderService: ChecklistTemplateOrderService,
    private readonly repository: ChecklistTemplateRepository,
  ) {}

  async addModule(templateId: number, input: AddModuleInput, userId: string) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        this.assertions.assertDraft(
          await this.repository.loadTemplateForMutation(
            tx,
            templateId,
            input.version,
          ),
        );
        const module = await this.assertions.loadActiveModule(
          tx,
          input.checklistModuleId,
        );
        const maxOrder = await this.maxModuleOrder(tx, templateId);

        const created = await tx.checklistTemplateModule.create({
          data: {
            checklistModuleId: module.id,
            checklistTemplateId: templateId,
            moduleNameSnapshot: module.name,
            sortOrder: maxOrder + 1,
          },
        });
        await this.repository.touchTemplate(tx, templateId, userId, input.version);
        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: templateId,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_MODULE_ADDED',
          newValue: created,
          userId,
        });

        return this.repository.loadTemplateDetail(templateId, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async removeModule(
    templateId: number,
    templateModuleId: number,
    input: TemplateMutationVersionInput,
    userId: string,
  ) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        this.assertions.assertDraft(
          await this.repository.loadTemplateForMutation(
            tx,
            templateId,
            input.version,
          ),
        );
        const module = await this.assertions.loadTemplateModule(
          tx,
          templateId,
          templateModuleId,
        );
        await tx.checklistTemplateModule.delete({ where: { id: templateModuleId } });
        await this.orderService.normalizeModuleOrder(tx, templateId);
        await this.repository.touchTemplate(tx, templateId, userId, input.version);
        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: templateId,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_MODULE_REMOVED',
          oldValue: module,
          userId,
        });

        return this.repository.loadTemplateDetail(templateId, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async addQuestion(
    templateId: number,
    templateModuleId: number,
    input: AddQuestionInput,
    userId: string,
  ) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        this.assertions.assertDraft(
          await this.repository.loadTemplateForMutation(
            tx,
            templateId,
            input.version,
          ),
        );
        const module = await this.assertions.loadTemplateModule(
          tx,
          templateId,
          templateModuleId,
        );
        const question = await this.assertions.loadActiveQuestion(
          tx,
          input.checklistQuestionId,
        );

        if (question.checklistModuleId !== module.checklistModuleId) {
          throwChecklistConflict(
            'CHECKLIST_QUESTION_MODULE_MISMATCH',
            'Вопрос относится к другому модулю.',
          );
        }

        const maxOrder = await this.maxQuestionOrder(tx, templateModuleId);
        const created = await tx.checklistTemplateQuestion.create({
          data: {
            answerTypeSnapshot: question.answerType,
            checklistQuestionId: question.id,
            checklistTemplateModuleId: templateModuleId,
            isRequired: input.isRequired,
            questionTextSnapshot: question.questionText,
            sortOrder: maxOrder + 1,
          },
        });
        await this.repository.touchTemplate(tx, templateId, userId, input.version);
        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: templateId,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_QUESTION_ADDED',
          newValue: created,
          userId,
        });

        return this.repository.loadTemplateDetail(templateId, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async updateQuestion(
    templateId: number,
    templateQuestionId: number,
    input: UpdateQuestionInput,
    userId: string,
  ) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        this.assertions.assertDraft(
          await this.repository.loadTemplateForMutation(
            tx,
            templateId,
            input.version,
          ),
        );
        const currentQuestion = await this.assertions.loadTemplateQuestion(
          tx,
          templateId,
          templateQuestionId,
        );
        await tx.checklistTemplateQuestion.update({
          data: { isRequired: input.isRequired },
          where: { id: templateQuestionId },
        });
        await this.repository.touchTemplate(tx, templateId, userId, input.version);
        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: templateId,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_QUESTION_UPDATED',
          newValue: { isRequired: input.isRequired, templateQuestionId },
          oldValue: {
            isRequired: currentQuestion.isRequired,
            templateQuestionId,
          },
          userId,
        });

        return this.repository.loadTemplateDetail(templateId, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async removeQuestion(
    templateId: number,
    templateQuestionId: number,
    input: TemplateMutationVersionInput,
    userId: string,
  ) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        this.assertions.assertDraft(
          await this.repository.loadTemplateForMutation(
            tx,
            templateId,
            input.version,
          ),
        );
        const question = await this.assertions.loadTemplateQuestion(
          tx,
          templateId,
          templateQuestionId,
        );
        await tx.checklistTemplateQuestion.delete({ where: { id: templateQuestionId } });
        await this.orderService.normalizeQuestionOrder(
          tx,
          question.checklistTemplateModuleId,
        );
        await this.repository.touchTemplate(tx, templateId, userId, input.version);
        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: templateId,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_QUESTION_REMOVED',
          oldValue: question,
          userId,
        });

        return this.repository.loadTemplateDetail(templateId, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  private async maxModuleOrder(
    tx: Prisma.TransactionClient,
    templateId: number,
  ) {
    const aggregate = await tx.checklistTemplateModule.aggregate({
      _max: { sortOrder: true },
      where: { checklistTemplateId: templateId },
    });

    return aggregate._max.sortOrder ?? 0;
  }

  private async maxQuestionOrder(
    tx: Prisma.TransactionClient,
    templateModuleId: number,
  ) {
    const aggregate = await tx.checklistTemplateQuestion.aggregate({
      _max: { sortOrder: true },
      where: { checklistTemplateModuleId: templateModuleId },
    });

    return aggregate._max.sortOrder ?? 0;
  }
}
