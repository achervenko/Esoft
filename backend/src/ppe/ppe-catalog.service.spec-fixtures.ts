import { PpeCatalogSizesService } from './ppe-catalog-sizes.service';
import { PpeCatalogService } from './ppe-catalog.service';
import { PpeAuditService } from './ppe-audit.service';

export const item = {
  id: 1,
  article: 'A',
  name: 'Boots',
  unit: 'пары',
  type: 'OTHER',
  isActive: true,
};

export const size = {
  id: 2,
  ppeItemId: 1,
  value: '42',
  heightValue: null,
  isActive: true,
};

export function createService() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
    ppeItem: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { ...item, isActive: false, sizes: [size], _count: { normItems: 0 } },
        ]),
      findUnique: jest.fn().mockResolvedValue({ ...item, sizes: [size] }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...item, type: 'FEET' }),
      create: jest.fn().mockResolvedValue(item),
      update: jest.fn().mockResolvedValue({ ...item, name: 'New boots' }),
    },
    ppeItemSize: {
      findMany: jest.fn().mockResolvedValue([size]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(size),
      create: jest.fn().mockResolvedValue(size),
      update: jest.fn().mockResolvedValue({ ...size, value: '43' }),
    },
    ppeNormItem: { count: jest.fn().mockResolvedValue(0) },
    ppeIssue: { count: jest.fn().mockResolvedValue(0) },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: (value: typeof tx) => unknown) => fn(tx)),
  };
  const auditLog = {
    writeFieldChanges: jest.fn().mockResolvedValue(undefined),
  };
  const audit = new PpeAuditService(auditLog as never);
  return {
    tx,
    auditLog,
    service: new PpeCatalogService(
      prisma as never,
      audit,
      new PpeCatalogSizesService(prisma as never, audit),
    ),
  };
}
