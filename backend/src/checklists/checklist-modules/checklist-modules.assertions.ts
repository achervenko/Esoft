import {
  throwChecklistConflict,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';
import type {
  ChecklistModuleView,
  ModuleReorderInput,
} from './checklist-modules.types';

export function assertModuleExists(
  module: ChecklistModuleView | null,
): asserts module is ChecklistModuleView {
  if (!module) {
    throwChecklistNotFound(
      'CHECKLIST_MODULE_NOT_FOUND',
      'Модуль чек-листа не найден.',
    );
  }
}

export function assertModuleStatusCanChange(
  module: ChecklistModuleView,
  isActive: boolean,
) {
  if (module.isActive !== isActive) {
    return;
  }

  throwChecklistConflict(
    isActive
      ? 'CHECKLIST_MODULE_ALREADY_ACTIVE'
      : 'CHECKLIST_MODULE_ALREADY_INACTIVE',
    isActive ? 'Модуль уже активен.' : 'Модуль уже отключён.',
  );
}

export function assertFullActiveModuleOrder(
  current: ChecklistModuleView[],
  items: ModuleReorderInput['items'],
) {
  const currentIds = current
    .map((module) => module.id)
    .sort((left, right) => left - right);
  const payloadIds = items
    .map((item) => item.id)
    .sort((left, right) => left - right);

  if (
    currentIds.length !== payloadIds.length ||
    currentIds.some((id, index) => id !== payloadIds[index])
  ) {
    throwChecklistConflict(
      'CHECKLIST_MODULE_ORDER_SET_MISMATCH',
      'Передайте полный актуальный список активных модулей.',
    );
  }
}
