import { Prisma } from '@prisma/client';
import { AuditLogService } from '../../audit/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WarehouseCatalogService } from './catalog.service';

function failingService(meta?: Record<string, unknown>, code = 'P2002') {
  const error = new Prisma.PrismaClientKnownRequestError('Unique conflict', {
    code,
    clientVersion: '7.9.0',
    meta,
  });
  const prisma = { $transaction: jest.fn().mockRejectedValue(error) };
  const service = new WarehouseCatalogService(
    prisma as unknown as PrismaService,
    {} as AuditLogService,
  );
  return {
    error,
    run: () =>
      service.create({ article: 'A', name: 'Item', unit: 'шт' }, 'actor'),
  };
}

const adapterMeta = (fields: unknown, extra: Record<string, unknown> = {}) => ({
  modelName: 'WarehouseItem',
  driverAdapterError: {
    cause: {
      kind: 'UniqueConstraintViolation',
      originalCode: '23505',
      constraint: { fields },
    },
  },
  ...extra,
});

describe('Catalog unique conflict mapping', () => {
  it.each([
    { modelName: 'WarehouseItem', target: ['article'] },
    { modelName: 'WarehouseItem', target: 'uq_warehouse_items_article' },
    { target: 'uq_warehouse_items_article' },
    adapterMeta(['article']),
  ])('maps only the article constraint %p', async (meta) => {
    await expect(failingService(meta).run()).rejects.toMatchObject({
      status: 409,
      response: { code: 'WAREHOUSE_ARTICLE_EXISTS' },
    });
  });

  it.each([
    undefined,
    {},
    { modelName: 'WarehouseItem' },
    { target: ['article'] },
    { modelName: 'WarehouseItem', target: ['id'] },
    { modelName: 'WarehouseItem', target: ['article', 'id'] },
    { modelName: 'WarehouseItem', target: 'uq_warehouse_items_article_other' },
    { modelName: 'AuditLog', target: ['id'] },
    { modelName: 'AuditLog', target: 'uq_warehouse_items_article' },
    { modelName: 'OtherModel', target: ['article'] },
    adapterMeta(['id']),
    adapterMeta(['article', 'id']),
    adapterMeta(['article'], { modelName: 'AuditLog' }),
    adapterMeta(['article'], { target: ['id'] }),
    adapterMeta(['article'], { modelName: undefined }),
    {
      modelName: 'WarehouseItem',
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          originalCode: '23503',
          constraint: { fields: ['article'] },
        },
      },
    },
  ])('preserves unrelated or unidentified P2002 %p', async (meta) => {
    const { error, run } = failingService(meta);
    await expect(run()).rejects.toBe(error);
  });

  it('does not map non-unique errors even with article metadata', async () => {
    const { error, run } = failingService(
      { modelName: 'WarehouseItem', target: ['article'] },
      'P2003',
    );
    await expect(run()).rejects.toBe(error);
  });
});
