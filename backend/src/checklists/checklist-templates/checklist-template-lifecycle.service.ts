import { Inject } from '@nestjs/common';
import { ACTIVE_MODULES } from '../../config/active-modules.module';
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
    @Inject(ACTIVE_MODULES)
    private readonly activeModules: readonly string[] = ['equipment'],
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

        const removedMaintenanceSettingLinks = this.activeModules.includes(
          'equipment',
        )
          ? (
              await tx.equipmentMaintenanceSetting.updateMany({
                data: {
                  defaultChecklistTemplateId: null,
                },
                where: {
                  defaultChecklistTemplateId: id,
                },
              })
            ).count
          : 0;

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
            removedMaintenanceSettingLinks,
          },
          userId,
        });

        return {
          removedMaintenanceSettingLinks,
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
