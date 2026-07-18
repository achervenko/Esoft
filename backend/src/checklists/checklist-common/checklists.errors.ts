import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwChecklistBadRequest(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

export function throwChecklistConflict(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new ConflictException({ code, message, details });
}

export function throwChecklistForbidden(code: string, message: string): never {
  throw new ForbiddenException({ code, message });
}

export function throwChecklistNotFound(code: string, message: string): never {
  throw new NotFoundException({ code, message });
}

export function throwChecklistPrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = getPrismaErrorTarget(error);

    if (
      hasConstraint(target, 'uq_checklist_modules_name') ||
      hasExactColumns(target, ['name'])
    ) {
      throwChecklistConflict(
        'CHECKLIST_MODULE_NAME_ALREADY_EXISTS',
        'Модуль чек-листа с таким названием уже существует.',
      );
    }

    if (hasConstraint(target, 'uq_checklist_modules_active_sort_order')) {
      throwChecklistConflict(
        'CHECKLIST_MODULE_SORT_ORDER_ALREADY_EXISTS',
        'В справочнике уже есть активный модуль с таким порядковым номером.',
      );
    }

    if (
      hasConstraint(target, 'uq_checklist_template_modules_module') ||
      hasExactColumns(target, ['checklist_template_id', 'checklist_module_id'])
    ) {
      throwChecklistConflict(
        'CHECKLIST_TEMPLATE_MODULE_ALREADY_ADDED',
        'Модуль уже добавлен в шаблон.',
      );
    }

    if (
      hasConstraint(target, 'uq_checklist_template_modules_sort') ||
      hasExactColumns(target, ['checklist_template_id', 'sort_order'])
    ) {
      throwChecklistConflict(
        'CHECKLIST_TEMPLATE_MODULE_SORT_ALREADY_EXISTS',
        'В шаблоне уже есть модуль с таким порядковым номером.',
      );
    }

    if (
      hasConstraint(target, 'uq_checklist_template_questions_question') ||
      hasExactColumns(target, [
        'checklist_template_module_id',
        'checklist_question_id',
      ])
    ) {
      throwChecklistConflict(
        'CHECKLIST_TEMPLATE_QUESTION_ALREADY_ADDED',
        'Вопрос уже добавлен в модуль шаблона.',
      );
    }

    if (
      hasConstraint(target, 'uq_checklist_questions_active_module_sort_order')
    ) {
      throwChecklistConflict(
        'CHECKLIST_QUESTION_SORT_ORDER_ALREADY_EXISTS',
        'В модуле уже есть активный вопрос с таким порядковым номером.',
      );
    }

    if (
      hasConstraint(target, 'uq_checklist_template_questions_sort') ||
      hasExactColumns(target, ['checklist_template_module_id', 'sort_order'])
    ) {
      throwChecklistConflict(
        'CHECKLIST_TEMPLATE_QUESTION_SORT_ALREADY_EXISTS',
        'В модуле шаблона уже есть вопрос с таким порядковым номером.',
      );
    }
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throwChecklistNotFound('CHECKLIST_NOT_FOUND', 'Запись не найдена.');
  }

  throw error;
}

function getPrismaErrorTarget(
  error: Prisma.PrismaClientKnownRequestError,
): string[] {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.filter((part): part is string => typeof part === 'string');
  }

  return typeof target === 'string' ? [target] : [];
}

function hasConstraint(target: string[], constraintName: string) {
  const normalizedConstraintName = normalizeTargetPart(constraintName);

  return target.some(
    (part) => normalizeTargetPart(part) === normalizedConstraintName,
  );
}

function hasExactColumns(target: string[], columns: string[]) {
  const normalizedTarget = target.map(normalizeTargetPart).sort();
  const normalizedColumns = columns.map(normalizeTargetPart).sort();

  return (
    normalizedTarget.length === normalizedColumns.length &&
    normalizedColumns.every(
      (column, index) => normalizedTarget[index] === column,
    )
  );
}

function normalizeTargetPart(value: string) {
  return value.toLowerCase();
}
