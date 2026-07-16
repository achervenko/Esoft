import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import { throwChecklistPrismaError } from '../checklist-common/checklists.errors';
import { presentTemplateDetail } from './checklist-templates.presenter';
import type {
  ModuleOrderInput,
  QuestionOrderInput,
} from './checklist-templates.types';
import { ChecklistTemplateAssertions } from './checklist-template.assertions';
import { ChecklistTemplateRepository } from './checklist-template.repository';

@Injectable()
export class ChecklistTemplateOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: ChecklistTemplateAssertions,
    private readonly repository: ChecklistTemplateRepository,
  ) {}

  async reorderModules(
    templateId: number,
    input: ModuleOrderInput,
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
        const modules = await tx.checklistTemplateModule.findMany({
          orderBy: { sortOrder: 'asc' },
          select: { id: true },
          where: { checklistTemplateId: templateId },
        });
        this.assertions.assertSameIds(
          modules.map((module) => module.id),
          input.moduleIds,
        );
        await this.applyModuleOrder(tx, input.moduleIds);
        await this.repository.touchTemplate(tx, templateId, userId, input.version);
        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: templateId,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_REORDERED',
          newValue: { entity: 'modules', newOrder: input.moduleIds },
          oldValue: {
            entity: 'modules',
            oldOrder: modules.map((item) => item.id),
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

  async reorderQuestions(
    templateId: number,
    templateModuleId: number,
    input: QuestionOrderInput,
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
        await this.assertions.loadTemplateModule(tx, templateId, templateModuleId);
        const questions = await tx.checklistTemplateQuestion.findMany({
          orderBy: { sortOrder: 'asc' },
          select: { id: true },
          where: { checklistTemplateModuleId: templateModuleId },
        });
        this.assertions.assertSameIds(
          questions.map((question) => question.id),
          input.questionIds,
        );
        await this.applyQuestionOrder(tx, input.questionIds);
        await this.repository.touchTemplate(tx, templateId, userId, input.version);
        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: templateId,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_REORDERED',
          newValue: { entity: 'questions', newOrder: input.questionIds },
          oldValue: {
            entity: 'questions',
            oldOrder: questions.map((item) => item.id),
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

  async normalizeModuleOrder(tx: Prisma.TransactionClient, templateId: number) {
    const modules = await tx.checklistTemplateModule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
      where: { checklistTemplateId: templateId },
    });
    await this.applyModuleOrder(tx, modules.map((module) => module.id));
  }

  async normalizeQuestionOrder(
    tx: Prisma.TransactionClient,
    templateModuleId: number,
  ) {
    const questions = await tx.checklistTemplateQuestion.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: { id: true },
      where: { checklistTemplateModuleId: templateModuleId },
    });
    await this.applyQuestionOrder(tx, questions.map((question) => question.id));
  }

  private async applyModuleOrder(
    tx: Prisma.TransactionClient,
    moduleIds: number[],
  ) {
    await Promise.all(
      moduleIds.map((id, index) =>
        tx.checklistTemplateModule.update({
          data: { sortOrder: -(index + 1) },
          where: { id },
        }),
      ),
    );
    await Promise.all(
      moduleIds.map((id, index) =>
        tx.checklistTemplateModule.update({
          data: { sortOrder: index + 1 },
          where: { id },
        }),
      ),
    );
  }

  private async applyQuestionOrder(
    tx: Prisma.TransactionClient,
    questionIds: number[],
  ) {
    await Promise.all(
      questionIds.map((id, index) =>
        tx.checklistTemplateQuestion.update({
          data: { sortOrder: -(index + 1) },
          where: { id },
        }),
      ),
    );
    await Promise.all(
      questionIds.map((id, index) =>
        tx.checklistTemplateQuestion.update({
          data: { sortOrder: index + 1 },
          where: { id },
        }),
      ),
    );
  }
}
