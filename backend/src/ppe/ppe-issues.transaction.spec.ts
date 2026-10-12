import { Prisma } from '@prisma/client';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { runPpeIssueTransaction } from './ppe-issues.transaction';

function fail(meta?: Record<string, unknown>, code = 'P2002') {
  const error = new Prisma.PrismaClientKnownRequestError('conflict', {
    code,
    clientVersion: '7.9.0',
    meta,
  });
  const prisma = { $transaction: jest.fn().mockRejectedValue(error) };
  return {
    error,
    run: () =>
      runPpeIssueTransaction(
        prisma as never,
        new PpeIssuesGuardsService(),
        () => Promise.resolve(null),
      ),
  };
}

describe('PPE issue transaction errors', () => {
  it.each([
    'duplicate key value violates unique constraint "uq_ppe_issues_regular_obligation"',
    'повторяющееся значение ключа нарушает ограничение уникальности "uq_ppe_issues_regular_obligation"',
  ])(
    'recognizes the exact index in PostgreSQL adapter metadata: %s',
    async (originalMessage) => {
      const { run } = fail({
        modelName: 'PpeIssue',
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            originalCode: '23505',
            originalMessage,
          },
        },
      });
      await expect(run()).rejects.toMatchObject({
        response: { code: 'PPE_NORM_ALREADY_ISSUED' },
      });
    },
  );
  it.each(['uq_ppe_items_article', 'uq_ppe_issues_regular_obligation_other'])(
    'does not map another adapter constraint %s',
    async (name) => {
      const { error, run } = fail({
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            originalCode: '23505',
            originalMessage: `duplicate key violates unique constraint "${name}"`,
          },
        },
      });
      await expect(run()).rejects.toBe(error);
    },
  );
  it.each([
    'uq_ppe_issues_regular_obligation',
    ['employee_id', 'norm_item_id', 'scheduled_at'],
    ['scheduledAt', 'employeeId', 'normItemId'],
  ])('maps only the regular obligation unique target %p', async (target) => {
    const { run } = fail({ modelName: 'PpeIssue', target });
    await expect(run()).rejects.toMatchObject({
      response: { code: 'PPE_NORM_ALREADY_ISSUED' },
    });
  });
  it.each([
    undefined,
    { target: 'another_index' },
    { target: ['id'] },
    { target: ['article'] },
    { target: ['employee_id', 'norm_item_id'] },
    {
      target: ['employee_id', 'norm_item_id', 'scheduled_at', 'other'],
    },
    { modelName: 'OtherModel', target: 'uq_ppe_issues_regular_obligation' },
  ])('preserves unrelated or unknown unique conflict %p', async (meta) => {
    const { error, run } = fail(meta);
    await expect(run()).rejects.toBe(error);
  });
  it.each([
    ['P2025', 'PPE_ISSUE_NOT_FOUND'],
    ['P2003', 'PPE_ISSUE_REFERENCE_CONFLICT'],
    ['P2034', 'PPE_ISSUE_REFERENCE_CONFLICT'],
  ])('preserves existing mapping for %s', async (code, expected) => {
    await expect(fail(undefined, code).run()).rejects.toMatchObject({
      response: { code: expected },
    });
  });
});
