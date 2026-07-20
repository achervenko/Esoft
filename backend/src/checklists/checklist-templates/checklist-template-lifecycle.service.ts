import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import {
  throwChecklistConflict,
  throwChecklistNotFound,
  throwChecklistPrismaError,
} from '../checklist-common/checklists.errors';
import { presentTemplateDetail } from './checklist-templates.presenter';
import type { ArchiveInput } from './checklist-templates.types';
import { ChecklistTemplateRepository } from './checklist-template.repository';

@Injectable()
export class ChecklistTemplateLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: ChecklistTemplateRepository,
  ) {}

  async archive(id: number, input: ArchiveInput, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await this.repository.loadTemplateForMutation(
          tx,
          id,
          input.version,
        );

        if (!current.isPublished) {
          throwChecklistNotFound(
            'CHECKLIST_TEMPLATE_NOT_FOUND',
            'Шаблон чек-листа не найден.',
          );
        }

        if (!current.isActive) {
          throwChecklistConflict(
            'CHECKLIST_TEMPLATE_ALREADY_ARCHIVED',
            'Шаблон уже удалён.',
          );
        }

        const unlinkResult = await tx.equipmentMaintenanceSetting.updateMany({
          data: {
            defaultChecklistTemplateId: null,
          },
          where: {
            defaultChecklistTemplateId: id,
          },
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
            removedMaintenanceSettingLinks: unlinkResult.count,
          },
          userId,
        });

        return {
          removedMaintenanceSettingLinks: unlinkResult.count,
          template: presentTemplateDetail(
            await this.repository.loadTemplateDetail(id, tx),
          ),
        };
      });
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }
}
