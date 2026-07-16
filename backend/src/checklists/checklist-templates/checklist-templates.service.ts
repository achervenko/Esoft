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
  AddModuleInput,
  AddQuestionInput,
  ArchiveInput,
  CopyInput,
  ModuleOrderInput,
  QuestionOrderInput,
  TemplateInput,
  TemplateMutationVersionInput,
  TemplateQuery,
  TemplateUpdateInput,
  UpdateQuestionInput,
} from './checklist-templates.types';
import { ChecklistTemplateAssertions } from './checklist-template.assertions';
import { ChecklistTemplateCopyService } from './checklist-template-copy.service';
import { ChecklistTemplateLifecycleService } from './checklist-template-lifecycle.service';
import { ChecklistTemplateOrderService } from './checklist-template-order.service';
import { ChecklistTemplateQueryService } from './checklist-template-query.service';
import { ChecklistTemplateRepository } from './checklist-template.repository';
import { ChecklistTemplateStructureService } from './checklist-template-structure.service';

@Injectable()
export class ChecklistTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: ChecklistTemplateAssertions,
    private readonly copyService: ChecklistTemplateCopyService,
    private readonly lifecycleService: ChecklistTemplateLifecycleService,
    private readonly orderService: ChecklistTemplateOrderService,
    private readonly queryService: ChecklistTemplateQueryService,
    private readonly repository: ChecklistTemplateRepository,
    private readonly structureService: ChecklistTemplateStructureService,
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
        await this.assertions.assertEquipmentModelExists(tx, input.equipmentModelId);
        await this.assertions.assertMaintenanceTypeExists(
          tx,
          input.maintenanceTypeId,
        );

        const created = await tx.checklistTemplate.create({
          data: {
            createdBy: userId,
            description: input.description,
            equipmentModelId: input.equipmentModelId,
            isActive: false,
            isPublished: false,
            maintenanceTypeId: input.maintenanceTypeId,
            name: input.name,
            updatedBy: userId,
          },
        });

        await writeChecklistAudit(tx, {
          action: AuditAction.CREATE,
          entityId: created.id,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_CREATED',
          newValue: { name: created.name },
          userId,
        });

        return this.repository.loadTemplateDetail(created.id, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async update(id: number, input: TemplateUpdateInput, userId: string) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        const current = await this.repository.loadTemplateForMutation(
          tx,
          id,
          input.version,
        );
        this.assertions.assertDraft(current);

        if (input.equipmentModelId !== undefined) {
          await this.assertions.assertEquipmentModelExists(
            tx,
            input.equipmentModelId,
          );
        }
        if (input.maintenanceTypeId !== undefined) {
          await this.assertions.assertMaintenanceTypeExists(
            tx,
            input.maintenanceTypeId,
          );
        }

        await this.repository.updateTemplateByExpectedVersion(tx, {
          data: {
            ...('description' in input
              ? { description: input.description }
              : {}),
            ...(input.equipmentModelId !== undefined
              ? { equipmentModelId: input.equipmentModelId }
              : {}),
            ...(input.maintenanceTypeId !== undefined
              ? { maintenanceTypeId: input.maintenanceTypeId }
              : {}),
            ...('name' in input ? { name: input.name } : {}),
            updatedBy: userId,
            version: { increment: 1 },
          },
          id,
          expectedVersion: input.version,
        });

        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: id,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_UPDATED',
          newValue: input,
          oldValue: {
            description: current.description,
            equipmentModelId: current.equipmentModelId,
            maintenanceTypeId: current.maintenanceTypeId,
            name: current.name,
          },
          userId,
        });

        return this.repository.loadTemplateDetail(id, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  addModule(templateId: number, input: AddModuleInput, userId: string) {
    return this.structureService.addModule(templateId, input, userId);
  }

  removeModule(
    templateId: number,
    templateModuleId: number,
    input: TemplateMutationVersionInput,
    userId: string,
  ) {
    return this.structureService.removeModule(
      templateId,
      templateModuleId,
      input,
      userId,
    );
  }

  addQuestion(
    templateId: number,
    templateModuleId: number,
    input: AddQuestionInput,
    userId: string,
  ) {
    return this.structureService.addQuestion(
      templateId,
      templateModuleId,
      input,
      userId,
    );
  }

  updateQuestion(
    templateId: number,
    templateQuestionId: number,
    input: UpdateQuestionInput,
    userId: string,
  ) {
    return this.structureService.updateQuestion(
      templateId,
      templateQuestionId,
      input,
      userId,
    );
  }

  removeQuestion(
    templateId: number,
    templateQuestionId: number,
    input: TemplateMutationVersionInput,
    userId: string,
  ) {
    return this.structureService.removeQuestion(
      templateId,
      templateQuestionId,
      input,
      userId,
    );
  }

  reorderModules(templateId: number, input: ModuleOrderInput, userId: string) {
    return this.orderService.reorderModules(templateId, input, userId);
  }

  reorderQuestions(
    templateId: number,
    templateModuleId: number,
    input: QuestionOrderInput,
    userId: string,
  ) {
    return this.orderService.reorderQuestions(
      templateId,
      templateModuleId,
      input,
      userId,
    );
  }

  publish(id: number, input: TemplateMutationVersionInput, userId: string) {
    return this.lifecycleService.publish(id, input, userId);
  }

  archive(id: number, input: ArchiveInput, userId: string) {
    return this.lifecycleService.archive(id, input, userId);
  }

  copy(id: number, input: CopyInput, userId: string) {
    return this.copyService.copy(id, input, userId);
  }

  async deleteDraft(
    id: number,
    input: TemplateMutationVersionInput,
    userId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await this.repository.loadTemplateForMutation(
          tx,
          id,
          input.version,
        );

        if (current.isPublished) {
          throwChecklistConflict(
            'CHECKLIST_TEMPLATE_ALREADY_PUBLISHED',
            'Опубликованный шаблон нельзя удалить.',
          );
        }

        const deleteResult = await tx.checklistTemplate.deleteMany({
          where: { id, version: input.version },
        });
        this.repository.assertSingleTemplateMutation(deleteResult.count, id);
        await writeChecklistAudit(tx, {
          action: AuditAction.DELETE,
          entityId: id,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_DRAFT_DELETED',
          oldValue: { name: current.name },
          userId,
        });

        return { ok: true };
      });
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }
}
