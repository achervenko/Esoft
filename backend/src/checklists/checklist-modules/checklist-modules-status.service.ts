import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import { throwChecklistPrismaError } from '../checklist-common/checklists.errors';
import {
  assertModuleExists,
  assertModuleStatusCanChange,
} from './checklist-modules.assertions';
import { ChecklistModulesOrderLockService } from './checklist-modules-order-lock.service';
import { ChecklistModulesReorderService } from './checklist-modules-reorder.service';
import { ChecklistModulesRepository } from './checklist-modules.repository';
import { ChecklistQuestionsOrderLockService } from '../checklist-questions/checklist-questions-order-lock.service';

@Injectable()
export class ChecklistModulesStatusService {
  constructor(
    private readonly modulesOrderLock: ChecklistModulesOrderLockService,
    private readonly modulesRepository: ChecklistModulesRepository,
    private readonly modulesReorderService: ChecklistModulesReorderService,
    private readonly questionsOrderLock: ChecklistQuestionsOrderLockService,
  ) {}

  activate(id: number, userId: string) {
    return this.setActive(id, true, userId);
  }

  deactivate(id: number, userId: string) {
    return this.setActive(id, false, userId);
  }

  private async setActive(id: number, isActive: boolean, userId: string) {
    try {
      const module = await this.modulesRepository.transaction(async (tx) => {
        await this.modulesOrderLock.lock(tx);

        if (!isActive) {
          await this.questionsOrderLock.lock(tx, id);
        }

        const current = await this.modulesRepository.findById(id, tx);
        assertModuleExists(current);
        assertModuleStatusCanChange(current, isActive);

        if (!isActive) {
          await this.modulesRepository.deactivateQuestionsByModuleId(
            id,
            userId,
            tx,
          );
        }

        await this.modulesRepository.updateStatus(
          id,
          {
            isActive,
            sortOrder: isActive
              ? await this.modulesRepository.getNextActiveSortOrder(tx)
              : current.sortOrder,
            updatedBy: userId,
          },
          tx,
        );

        if (!isActive) {
          await this.modulesReorderService.normalizeActiveModuleOrder(
            tx,
            userId,
          );
        }

        const updated = await this.modulesRepository.findById(id, tx);
        assertModuleExists(updated);

        await writeChecklistAudit(tx, {
          action: AuditAction.STATUS_CHANGE,
          entityId: id,
          entityType: 'checklist_module',
          fieldName: isActive
            ? 'CHECKLIST_MODULE_ACTIVATED'
            : 'CHECKLIST_MODULE_DEACTIVATED',
          newValue: updated,
          oldValue: current,
          userId,
        });

        return updated;
      });

      return { module };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }
}
