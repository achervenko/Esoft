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
  TemplateMutationVersionInput,
} from './checklist-templates.types';
import { ChecklistTemplateAssertions } from './checklist-template.assertions';
import { ChecklistTemplateRepository } from './checklist-template.repository';

@Injectable()
export class ChecklistTemplateLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertions: ChecklistTemplateAssertions,
    private readonly repository: ChecklistTemplateRepository,
  ) {}

  async publish(
    id: number,
    input: TemplateMutationVersionInput,
    userId: string,
  ) {
    try {
      const template = await this.prisma.$transaction(async (tx) => {
        const current = await this.repository.loadTemplateDetail(id, tx);
        this.repository.assertVersionMatches(current.version, input.version, id);
        this.assertions.assertDraft(current);
        await this.assertions.assertEquipmentModelExists(
          tx,
          current.equipmentModelId,
        );
        await this.assertions.assertMaintenanceTypeExists(
          tx,
          current.maintenanceTypeId,
        );
        this.assertions.assertPublishable(current);
        await this.repository.updateTemplateByExpectedVersion(tx, {
          data: {
            isActive: true,
            isPublished: true,
            publishedAt: new Date(),
            publishedBy: userId,
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
          fieldName: 'CHECKLIST_TEMPLATE_PUBLISHED',
          userId,
        });

        return this.repository.loadTemplateDetail(id, tx);
      });

      return { template: presentTemplateDetail(template) };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async archive(id: number, input: ArchiveInput, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await this.repository.loadTemplateForMutation(
          tx,
          id,
          input.version,
        );

        if (!current.isPublished) {
          throwChecklistConflict(
            'CHECKLIST_TEMPLATE_NOT_PUBLISHED',
            'Черновик нельзя архивировать.',
          );
        }

        if (!current.isActive) {
          throwChecklistConflict(
            'CHECKLIST_TEMPLATE_ALREADY_ARCHIVED',
            'Шаблон уже архивирован.',
          );
        }

        const deletedLinks =
          await tx.equipmentMaintenanceSettingChecklistTemplate.deleteMany({
            where: { checklistTemplateId: id },
          });
        await this.repository.updateTemplateByExpectedVersion(tx, {
          data: {
            archivedAt: new Date(),
            archivedBy: userId,
            isActive: false,
            updatedBy: userId,
            version: { increment: 1 },
          },
          id,
          expectedVersion: input.version,
        });
        await writeChecklistAudit(tx, {
          action: AuditAction.ARCHIVE,
          entityId: id,
          entityType: 'checklist_template',
          fieldName: 'CHECKLIST_TEMPLATE_ARCHIVED',
          newValue: {
            reason: input.reason,
            removedMaintenanceSettingLinks: deletedLinks.count,
          },
          userId,
        });

        return {
          removedMaintenanceSettingLinks: deletedLinks.count,
          state: 'ARCHIVED',
          templateId: id,
        };
      });
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }
}
