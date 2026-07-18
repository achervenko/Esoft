import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import {
  throwChecklistConflict,
  throwChecklistPrismaError,
} from '../checklist-common/checklists.errors';
import { presentTemplateDetail } from './checklist-templates.presenter';
import type {
  ArchiveInput,
  TemplateInput,
  TemplateQuery,
} from './checklist-templates.types';
import { ChecklistTemplateAssertions } from './checklist-template.assertions';
import { ChecklistTemplateLifecycleService } from './checklist-template-lifecycle.service';
import { ChecklistTemplateQueryService } from './checklist-template-query.service';
import { ChecklistTemplateRepository } from './checklist-template.repository';

@Injectable()
export class ChecklistTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: ChecklistTemplateAssertions,
    private readonly lifecycleService: ChecklistTemplateLifecycleService,
    private readonly queryService: ChecklistTemplateQueryService,
    private readonly repository: ChecklistTemplateRepository,
  ) {}

  list(query: TemplateQuery) {
    return this.queryService.list(query);
  }

  get(id: number) {
    return this.queryService.get(id);
  }

  async create(input: TemplateInput, userId: string) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        const publishedAt = new Date();
        const created = await tx.checklistTemplate.create({
          data: {
            archivedAt: null,
            createdBy: userId,
            description: input.description,
            isActive: false,
            isPublished: false,
            name: input.name,
            publishedAt: null,
            publishedBy: null,
            updatedBy: userId,
          },
        });
        const moduleSnapshots: Array<{
          checklistModuleId: number;
          name: string;
          questions: Array<{
            checklistQuestionId: number;
            isRequired: boolean;
            questionText: string;
          }>;
        }> = [];

        for (const moduleInput of input.modules) {
          const module = await this.assertions.loadActiveModule(
            tx,
            moduleInput.checklistModuleId,
          );
          const createdModule = await tx.checklistTemplateModule.create({
            data: {
              checklistModuleId: module.id,
              checklistTemplateId: created.id,
              moduleNameSnapshot: module.name,
              sortOrder: moduleInput.sortOrder,
            },
          });
          const questionSnapshots: Array<{
            checklistQuestionId: number;
            isRequired: boolean;
            questionText: string;
          }> = [];

          for (const questionInput of moduleInput.questions) {
            const question = await this.assertions.loadActiveQuestion(
              tx,
              questionInput.checklistQuestionId,
            );

            if (question.checklistModuleId !== module.id) {
              throwChecklistConflict(
                'CHECKLIST_QUESTION_MODULE_MISMATCH',
                'Вопрос относится к другому модулю.',
              );
            }

            await tx.checklistTemplateQuestion.create({
              data: {
                answerTypeSnapshot: question.answerType,
                checklistQuestionId: question.id,
                checklistTemplateModuleId: createdModule.id,
                isRequired: questionInput.isRequired,
                questionTextSnapshot: question.questionText,
                sortOrder: questionInput.sortOrder,
              },
            });
            questionSnapshots.push({
              checklistQuestionId: question.id,
              isRequired: questionInput.isRequired,
              questionText: question.questionText,
            });
          }

          moduleSnapshots.push({
            checklistModuleId: module.id,
            name: module.name,
            questions: questionSnapshots,
          });
        }

        await tx.checklistTemplate.update({
          data: {
            isActive: true,
            isPublished: true,
            publishedAt,
            publishedBy: userId,
            updatedBy: userId,
          },
          where: { id: created.id },
        });

        await writeChecklistAudit(tx, {
          action: AuditAction.CREATE,
          entityId: created.id,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_CREATED',
          newValue: {
            description: created.description,
            modules: moduleSnapshots,
            name: created.name,
          },
          userId,
        });

        return this.repository.loadTemplateDetail(created.id, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  archive(id: number, input: ArchiveInput, userId: string) {
    return this.lifecycleService.archive(id, input, userId);
  }
}
