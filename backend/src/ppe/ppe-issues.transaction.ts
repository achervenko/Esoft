import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { ppeNotFound } from './ppe.errors';

function isRegularObligationConflict(
  error: Prisma.PrismaClientKnownRequestError,
) {
  const target: unknown = error.meta?.target;
  if (error.meta?.modelName && error.meta.modelName !== 'PpeIssue')
    return false;
  if (target === 'uq_ppe_issues_regular_obligation') return true;
  if (target === undefined) {
    const adapter: unknown = error.meta?.driverAdapterError;
    if (adapter && typeof adapter === 'object' && 'cause' in adapter) {
      const cause: unknown = adapter.cause;
      if (
        cause &&
        typeof cause === 'object' &&
        'originalCode' in cause &&
        'originalMessage' in cause &&
        'kind' in cause
      ) {
        return (
          cause.originalCode === '23505' &&
          cause.kind === 'UniqueConstraintViolation' &&
          typeof cause.originalMessage === 'string' &&
          cause.originalMessage.includes('"uq_ppe_issues_regular_obligation"')
        );
      }
    }
  }
  if (!Array.isArray(target) || target.length !== 3) return false;
  return [
    ['employee_id', 'norm_item_id', 'scheduled_at'],
    ['employeeId', 'normItemId', 'scheduledAt'],
  ].some((fields) => fields.every((field) => target.includes(field)));
}

export async function runPpeIssueTransaction<T>(
  prisma: PrismaService,
  guards: PpeIssuesGuardsService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  try {
    return await prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 15_000,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && isRegularObligationConflict(error))
        guards.conflict(
          'PPE_NORM_ALREADY_ISSUED',
          'Нормативная обязанность уже закрыта.',
        );
      if (error.code === 'P2025') ppeNotFound('PPE_ISSUE_NOT_FOUND');
      if (error.code === 'P2003' || error.code === 'P2034')
        guards.conflict(
          'PPE_ISSUE_REFERENCE_CONFLICT',
          'Связанные данные изменились. Повторите операцию.',
        );
    }
    throw error;
  }
}
