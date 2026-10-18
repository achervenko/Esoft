import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createEquipmentWriteFixture,
  createDto,
  createEquipmentWithRelations,
} from './equipment-write.spec-fixtures';

describe('EquipmentWriteService create', () => {
  it('creates equipment and returns a presented card', async () => {
    const {
      service,
      useTransactionMock,
      logEquipmentCreated,
      upsertEquipment,
      syncSequence,
      assertCountryExists,
      assertEquipmentModelExists,
      assertResponsibleEmployeeIsActive,
      assertSectionExists,
    } = createEquipmentWriteFixture();
    const equipmentWithRelations = createEquipmentWithRelations({
      id: 101,
      visibleId: 500,
    });
    const tx = {
      equipment: {
        create: jest.fn().mockResolvedValue({ id: 101 }),
        findUnique: jest.fn().mockResolvedValue(equipmentWithRelations),
      },
    };

    useTransactionMock(tx);

    const result = await service.create(
      createDto({ visibleId: 500 }),
      'user-1',
    );

    expect(assertEquipmentModelExists).toHaveBeenCalledWith(tx, 2);
    expect(assertResponsibleEmployeeIsActive).toHaveBeenCalledWith(tx, 7);
    expect(assertSectionExists).toHaveBeenCalledWith(tx, 3);
    expect(assertCountryExists).toHaveBeenCalledWith(tx, null);
    expect(logEquipmentCreated).toHaveBeenCalledWith(101, 'user-1', tx);
    expect(upsertEquipment).toHaveBeenCalledWith(tx, 101);
    expect(syncSequence).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        manufacturer: 'DMG',
        model: 'CTX',
        visibleId: 500,
      }),
    );
  });

  it('does not sync numbering when visibleId is not provided manually', async () => {
    const { service, useTransactionMock, syncSequence } =
      createEquipmentWriteFixture();
    const equipmentWithRelations = createEquipmentWithRelations({
      id: 101,
      visibleId: 42,
    });
    const tx = {
      equipment: {
        create: jest.fn().mockResolvedValue({ id: 101 }),
        findUnique: jest.fn().mockResolvedValue(equipmentWithRelations),
      },
    };

    useTransactionMock(tx);

    await service.create(createDto({ visibleId: undefined }), 'user-1');

    expect(syncSequence).not.toHaveBeenCalled();
  });

  it('throws conflict when a custom visible id already exists on create', async () => {
    const { service, prisma } = createEquipmentWriteFixture();
    prisma.equipment.findUnique.mockResolvedValue({ id: 1 });

    await expect(
      service.create(createDto({ visibleId: 500 }), 'user-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('maps Prisma unique conflicts from transaction failures', async () => {
    const { service, prisma } = createEquipmentWriteFixture();
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        clientVersion: 'test',
        code: 'P2002',
        meta: { target: ['inventory_number'] },
      }),
    );

    await expect(
      service.create(createDto({ visibleId: undefined }), 'user-1'),
    ).rejects.toThrow(ConflictException);
  });
});
