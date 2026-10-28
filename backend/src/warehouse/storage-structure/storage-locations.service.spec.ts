import { Prisma } from '@prisma/client';
import { WarehouseStorageLocationsService } from './storage-locations.service';
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
  return new WarehouseStorageLocationsService(
    prisma as unknown as PrismaService,
    {} as AuditLogService,
  );
}
describe('Storage location name conflict mapping', () => {
  const duplicates = [
    { modelName: 'WarehouseStorageLocation', target: ['warehouseId', 'name'] },
    { target: 'uq_warehouse_storage_locations_warehouse_name' },
    {
      modelName: 'WarehouseStorageLocation',
      target: 'uq_warehouse_storage_locations_warehouse_name',
    },
    adapter({ index: 'uq_warehouse_storage_locations_warehouse_name' }),
    adapter({ fields: ['warehouseId', 'name'] }),
    adapter({ fields: ['warehouse_id', 'name'] }),
    { target: null, ...adapter({ fields: ['name', 'warehouse_id'] }) },
    {
      target: null,
      ...adapter({ index: 'uq_warehouse_storage_locations_warehouse_name' }),
    },
    {
      modelName: 'WarehouseStorageLocation',
      ...adapter({ fields: ['warehouse_id', 'name'] }),
    },
    {
      modelName: 'WarehouseStorageLocation',
      ...adapter({ fields: ['warehouseId', 'name'] }),
    },
    {
      modelName: 'WarehouseStorageLocation',
      target: null,
      ...adapter({ index: 'uq_warehouse_storage_locations_warehouse_name' }),
    },
  ];
  it.each(duplicates)(
    'returns a domain 409 for %j on create and update',
    async (meta) => {
      const service = serviceFor(known(meta));
      for (const operation of [
        () => service.create({ warehouseId: '1', name: 'Shelf' }, 'actor'),
        () =>
          service.update('1', { name: 'WarehouseStorageLocation' }, 'actor'),
      ])
        await expect(operation()).rejects.toMatchObject({
          status: 409,
          response: { code: 'WAREHOUSE_STORAGE_LOCATION_NAME_CONFLICT' },
        });
    },
  );
  const unrelated = [
    known(),
    known({ modelName: 'WarehouseStorageLocation' }),
    known({ modelName: 'WarehouseStorageLocation', target: ['id'] }),
    known({ target: ['warehouseId', 'name'] }),
    known({ modelName: 'AuditLog', target: ['warehouseId', 'name'] }),
    known({
      modelName: 'AuditLog',
      ...adapter({ index: 'uq_warehouse_storage_locations_warehouse_name' }),
    }),
    known(adapter({ index: 'another_index' })),
    known(adapter({ fields: ['name'] })),
    known(adapter({ fields: ['warehouse_id', 'id'] })),
    known({
      modelName: 'AuditLog',
      ...adapter({ fields: ['warehouse_id', 'name'] }),
    }),
    known({
      driverAdapterError: {
        cause: {
          kind: 'UniqueConstraintViolation',
          originalCode: '23503',
          constraint: {
            index: 'uq_warehouse_storage_locations_warehouse_name',
          },
        },
      },
    }),
    known({ modelName: 'WarehouseStorageLocation', driverAdapterError: null }),
    known(
      {
        modelName: 'WarehouseStorageLocation',
        target: ['warehouseId', 'name'],
      },
      'P2003',
    ),
    new Error('connection lost'),
  ];
  it.each(unrelated)('preserves unrelated error %#', async (error) => {
    await expect(
      serviceFor(error).create({ warehouseId: '1', name: 'Shelf' }, 'actor'),
    ).rejects.toBe(error);
  });
});
