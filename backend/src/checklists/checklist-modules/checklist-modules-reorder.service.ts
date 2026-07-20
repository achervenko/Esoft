import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { writeChecklistAudit } from '../checklist-common/checklists.audit';
import { throwChecklistPrismaError } from '../checklist-common/checklists.errors';
import { assertFullActiveModuleOrder } from './checklist-modules.assertions';
import { ChecklistModulesOrderLockService } from './checklist-modules-order-lock.service';
import { ChecklistModulesRepository } from './checklist-modules.repository';
import type { ModuleReorderInput } from './checklist-modules.types';

const TEMP_SORT_ORDER_OFFSET = 1_000_000;

@Injectable()
export class ChecklistModulesReorderService {
  constructor(
    private readonly modulesOrderLock: ChecklistModulesOrderLockService,
    private readonly modulesRepository: ChecklistModulesRepository,
  ) {}

  async reorder(input: ModuleReorderInput, userId: string) {
    try {
      const modules = await this.modulesRepository.transaction(async (tx) => {
        await this.modulesOrderLock.lock(tx);

        const current = await this.modulesRepository.findActiveOrdered(tx);

        assertFullActiveModuleOrder(current, input.items);

        if (!hasModuleOrderChanges(current, input)) {
          return current;
        }

        await this.applyTemporarySortOrder(
          input.items.map((item) => item.id),
          userId,
          tx,
        );

        await Promise.all(
          input.items.map((item) =>
            this.modulesRepository.updateSortOrder(
              item.id,
              item.sortOrder,
              userId,
              tx,
            ),
          ),
        );

        const updated = await this.modulesRepository.findActiveOrdered(tx);

        await writeChecklistAudit(tx, {
          action: AuditAction.UPDATE,
          entityId: 0,
          entityType: 'checklist_module',
          fieldName: 'CHECKLIST_MODULE_ORDER_UPDATED',
          newValue: updated.map(({ id, sortOrder }) => ({ id, sortOrder })),
          oldValue: current.map(({ id, sortOrder }) => ({ id, sortOrder })),
          userId,
        });

        return updated;
      });

      return { modules };
    } catch (error) {
      throwChecklistPrismaError(error);
    }
  }

  async normalizeActiveModuleOrder(
    tx: Prisma.TransactionClient,
    userId: string,
  ) {
    await this.modulesOrderLock.lock(tx);

    const modules = await this.modulesRepository.findActiveIdsOrdered(tx);
    const moduleIds = modules.map((module) => module.id);

    await this.applyTemporarySortOrder(moduleIds, userId, tx);

    await Promise.all(
      modules.map((module, index) =>
        this.modulesRepository.updateSortOrder(
          module.id,
          index + 1,
          userId,
          tx,
        ),
      ),
    );
  }

  private async applyTemporarySortOrder(
    moduleIds: number[],
    userId: string,
    tx: Prisma.TransactionClient,
  ) {
    await Promise.all(
      moduleIds.map((moduleId, index) =>
        this.modulesRepository.updateSortOrder(
          moduleId,
          TEMP_SORT_ORDER_OFFSET + index + 1,
          userId,
          tx,
        ),
      ),
    );
  }
}

function hasModuleOrderChanges(
  current: Array<{ id: number; sortOrder: number }>,
  input: ModuleReorderInput,
) {
  const requestedOrder = new Map(
    input.items.map((item) => [item.id, item.sortOrder]),
  );

  return current.some(
    (module) => requestedOrder.get(module.id) !== module.sortOrder,
  );
}
