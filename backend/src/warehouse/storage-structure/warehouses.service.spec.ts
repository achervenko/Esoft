import { Prisma } from '@prisma/client';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
const adapter = (constraint: unknown) => ({
  driverAdapterError: {
    cause: {
      kind: 'UniqueConstraintViolation',
      originalCode: '23505',
      constraint,
    },
  },
});
const known = (meta?: Record<string, unknown>, code = 'P2002') =>
  new Prisma.PrismaClientKnownRequestError('Database error', {
    code,
    clientVersion: 'test',
    meta,
  });
function serviceFor(error: unknown) {
  const prisma = { $transaction: jest.fn().mockRejectedValue(error) };
  return new WarehousesService(
    prisma as unknown as PrismaService,
    {} as AuditLogService,
  );
}
describe('Warehouse code conflict mapping', () => {
  const duplicates = [
    { modelName: 'Warehouse', target: ['code'] },
    { target: 'uq_warehouses_code' },
    { modelName: 'Warehouse', target: 'uq_warehouses_code' },
    adapter({ index: 'uq_warehouses_code' }),
    { modelName: 'Warehouse', ...adapter({ fields: ['code'] }) },
    {
      modelName: 'Warehouse',
      target: null,
      ...adapter({ index: 'uq_warehouses_code' }),
    },
  ];
  it.each(duplicates)(
    'returns a domain 409 for %j on create and update',
    async (meta) => {
      const service = serviceFor(known(meta));
      for (const operation of [
        () => service.create({ code: 'A', name: 'Warehouse' }, 'actor'),
        () => service.update('1', { code: 'A' }, 'actor'),
      ])
        await expect(operation()).rejects.toMatchObject({
          status: 409,
          response: { code: 'WAREHOUSE_CODE_CONFLICT' },
        });
    },
  );
  const unrelated = [
    known(),
    known({ modelName: 'Warehouse' }),
    known({ modelName: 'Warehouse', target: ['id'] }),
    known({ target: ['code'] }),
    known({ modelName: 'AuditLog', target: ['code'] }),
    known({
      modelName: 'AuditLog',
      ...adapter({ index: 'uq_warehouses_code' }),
    }),
    known(adapter({ index: 'another_index' })),
    known(adapter({ fields: ['code'] })),
    known({
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          originalCode: '23503',
          constraint: { index: 'uq_warehouses_code' },
        },
      },
    }),
    known({ modelName: 'Warehouse', driverAdapterError: null }),
    known({ modelName: 'Warehouse', target: ['code'] }, 'P2003'),
    new Error('connection lost'),
  ];
  it.each(unrelated)('preserves unrelated error %#', async (error) => {
    await expect(
      serviceFor(error).create({ code: 'A', name: 'Warehouse' }, 'actor'),
    ).rejects.toBe(error);
  });
});
