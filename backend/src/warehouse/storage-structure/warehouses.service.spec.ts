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
describe('Warehouse name conflict mapping', () => {
  const duplicates = [
    { modelName: 'Warehouse', target: ['name'] },
    { target: 'uq_warehouses_name' },
    { modelName: 'Warehouse', target: 'uq_warehouses_name' },
    adapter({ index: 'uq_warehouses_name' }),
    { modelName: 'Warehouse', ...adapter({ fields: ['name'] }) },
    {
      modelName: 'Warehouse',
      target: null,
      ...adapter({ index: 'uq_warehouses_name' }),
    },
  ];
  it.each(duplicates)(
    'returns a domain 409 for %j on create and update',
    async (meta) => {
      const service = serviceFor(known(meta));
      for (const operation of [
        () => service.create({ name: 'Warehouse' }, 'actor'),
        () => service.update('1', { name: 'Warehouse' }, 'actor'),
      ])
        await expect(operation()).rejects.toMatchObject({
          status: 409,
          response: { code: 'WAREHOUSE_NAME_CONFLICT' },
        });
    },
  );
  const unrelated = [
    known(),
    known({ modelName: 'Warehouse' }),
    known({ modelName: 'Warehouse', target: ['id'] }),
    known({ target: ['name'] }),
    known({ modelName: 'AuditLog', target: ['name'] }),
    known({
      modelName: 'AuditLog',
      ...adapter({ index: 'uq_warehouses_name' }),
    }),
    known(adapter({ index: 'another_index' })),
    known(adapter({ fields: ['name'] })),
    known({
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          originalCode: '23503',
          constraint: { index: 'uq_warehouses_name' },
        },
      },
    }),
    known({ modelName: 'Warehouse', driverAdapterError: null }),
    known({ modelName: 'Warehouse', target: ['name'] }, 'P2003'),
    new Error('connection lost'),
  ];
  it.each(unrelated)('preserves unrelated error %#', async (error) => {
    await expect(
      serviceFor(error).create({ name: 'Warehouse' }, 'actor'),
    ).rejects.toBe(error);
  });
});
