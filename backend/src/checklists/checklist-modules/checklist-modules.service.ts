import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import { throwChecklistPrismaError } from '../checklist-common/checklists.errors';
import { assertModuleExists } from './checklist-modules.assertions';
import { ChecklistModulesOrderLockService } from './checklist-modules-order-lock.service';
import { ChecklistModulesReorderService } from './checklist-modules-reorder.service';
import { ChecklistModulesRepository } from './checklist-modules.repository';
import { ChecklistModulesStatusService } from './checklist-modules-status.service';
import type {
  ChecklistModuleView,
  ModuleInput,
  ModuleQuery,
  ModuleReorderInput,
  ModuleUpdateInput,
} from './checklist-modules.types';

@Injectable()
export class ChecklistModulesService {
  constructor(
    private readonly modulesOrderLock: ChecklistModulesOrderLockService,
    private readonly modulesRepository: ChecklistModulesRepository,
    private readonly modulesReorderService: ChecklistModulesReorderService,
    private readonly modulesStatusService: ChecklistModulesStatusService,
  ) {}

  list(query: ModuleQuery) {
    return this.modulesRepository.list(query);
  }

  async get(id: number) {
    const module = await this.modulesRepository.findById(id);
    assertModuleExists(module);

    return { module };
  }

  async create(input: ModuleInput, userId: string) {
    try {
      const module = await this.modulesRepository.transaction(async (tx) => {
        await this.modulesOrderLock.lock(tx);

        const created = await this.modulesRepository.create(
          input,
          userId,
          await this.modulesRepository.getNextActiveSortOrder(tx),
          tx,
        );

        await writeChecklistAudit(tx, {
          action: AuditAction.CREATE,
          entityId: created.id,
          entityType: 'checklist_module',
          fieldName: 'CHECKLIST_MODULE_CREATED',
          newValue: created,
          userId,
        });

        return created;
      });

      return { module };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async update(id: number, input: ModuleUpdateInput, userId: string) {
    try {
      const module = await this.modulesRepository.transaction(async (tx) => {
        const current = await this.modulesRepository.loadForMutation(id, tx);
        assertModuleExists(current);

        if (!hasModuleChanges(current, input)) {
          return current;
        }

        const updated = await this.modulesRepository.update(
          id,
          input,
          userId,
          tx,
        );

        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: id,
          entityType: 'checklist_module',
          fieldName: 'CHECKLIST_MODULE_UPDATED',
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

  activate(id: number, userId: string) {
    return this.modulesStatusService.activate(id, userId);
  }

  deactivate(id: number, userId: string) {
    return this.modulesStatusService.deactivate(id, userId);
  }

  reorder(input: ModuleReorderInput, userId: string) {
    return this.modulesReorderService.reorder(input, userId);
  }
}

function hasModuleChanges(
  current: ChecklistModuleView,
  input: ModuleUpdateInput,
) {
  return (
    ('description' in input && current.description !== input.description) ||
    ('name' in input && current.name !== input.name)
  );
}
