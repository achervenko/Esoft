import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import { throwChecklistPrismaError } from '../checklist-common/checklists.errors';
import { presentTemplateDetail } from './checklist-templates.presenter';
import type { CopyInput } from './checklist-templates.types';
import { ChecklistTemplateRepository } from './checklist-template.repository';

@Injectable()
export class ChecklistTemplateCopyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ChecklistTemplateRepository,
  ) {}

  async copy(id: number, input: CopyInput, userId: string) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        const source = await this.repository.loadTemplateDetail(id, tx);
        const created = await tx.checklistTemplate.create({
          data: {
            basedOnTemplateId: source.id,
            createdBy: userId,
            description: source.description,
            equipmentModelId: source.equipmentModelId,
            isActive: false,
            isPublished: false,
            maintenanceTypeId: source.maintenanceTypeId,
            name: input.name,
            updatedBy: userId,
          },
        });
        let copiedModuleCount = 0;

        for (const module of source.modules.sort((a, b) => a.sortOrder - b.sortOrder)) {
          const createdModule = await tx.checklistTemplateModule.create({
            data: {
              checklistModuleId: module.checklistModuleId,
              checklistTemplateId: created.id,
              moduleNameSnapshot: module.moduleNameSnapshot,
              sortOrder: module.sortOrder,
            },
          });
          copiedModuleCount += 1;

          for (const question of module.questions.sort(
            (a, b) => a.sortOrder - b.sortOrder,
          )) {
            await tx.checklistTemplateQuestion.create({
              data: {
                answerTypeSnapshot: question.answerTypeSnapshot,
                checklistQuestionId: question.checklistQuestionId,
                checklistTemplateModuleId: createdModule.id,
                isRequired: question.isRequired,
                questionTextSnapshot: question.questionTextSnapshot,
                sortOrder: question.sortOrder,
              },
            });
          }
        }

        await writeChecklistAudit(tx, {
          action: AuditAction.CREATE,
          entityId: created.id,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_COPIED',
          newValue: { basedOnTemplateId: id, moduleCount: copiedModuleCount },
          userId,
        });

        return this.repository.loadTemplateDetail(created.id, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }
}
