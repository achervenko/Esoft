import { EquipmentQueryService } from './equipment-query.service';
import { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { PrismaService } from '../prisma/prisma.service';

describe('equipment page bounds', () => {
  const setup = (total: number) => {
    const prisma = {
      equipment: {
        count: jest.fn().mockResolvedValue(total),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const transaction = jest.fn((fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    Object.assign(prisma, { $transaction: transaction });
    const service = new EquipmentQueryService(
      {} as IdentityNumberingService,
      prisma as unknown as PrismaService,
    );
    return { service, prisma, transaction };
  };

  it.each([0, 100000])(
    'skips sorting and offset scans beyond %i rows',
    async (total) => {
      const { service, prisma } = setup(total);
      expect(await service.findAll({ page: '1000000' })).toEqual({
        items: [],
        total,
        page: 1000000,
        limit: 100,
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.equipment.findMany).not.toHaveBeenCalled();
    },
  );

  it('uses one repeatable-read snapshot for count, page IDs and hydration', async () => {
    const { service, transaction } = setup(1);
    await service.findAll();
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });

  it('keeps the last existing page accessible', async () => {
    const { service, prisma } = setup(100000);
    prisma.$queryRaw.mockResolvedValue([{ id: 99901 }]);
    await service.findAll({ page: '1000' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [99901] } } }),
    );
  });
});

describe('equipment options numbering', () => {
  it.each([undefined, 4])(
    'only suggests a new number for creation (visibleId=%s)',
    async (visibleId) => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = {
        equipment: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ modelId: 8, model: { manufacturerId: 2 } }),
        },
        manufacturer: { findMany },
        equipmentModel: { findMany },
        country: { findMany },
        section: { findMany },
        employee: { findMany },
      };
      const numbering = { getNextId: jest.fn().mockResolvedValue(10) };
      const service = new EquipmentQueryService(
        numbering as unknown as IdentityNumberingService,
        prisma as unknown as PrismaService,
      );
      const options = await service.getCreateOptions(visibleId);
      expect(numbering.getNextId).toHaveBeenCalledTimes(
        visibleId === undefined ? 1 : 0,
      );
      expect(options.nextVisibleId).toBe(visibleId ?? 10);
    },
  );
});
