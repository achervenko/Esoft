import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  createEquipmentWriteFixture,
  createDto,
  createEquipmentWithRelations,
} from './equipment-write.spec-fixtures';

describe('EquipmentWriteService update', () => {
  it('updates equipment, refreshes search, writes audit and returns a presented card', async () => {
    const {
      service,
      useTransactionMock,
      logEquipmentUpdated,
      upsertEquipment,
    } = createEquipmentWriteFixture();
    const currentEquipment = createEquipmentWithRelations({
      id: 101,
      visibleId: 42,
    });
    const updatedEquipment = createEquipmentWithRelations({
      id: 101,
      visibleId: 42,
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 101 }]),
      equipment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(currentEquipment)
          .mockResolvedValueOnce(updatedEquipment),
        update: jest.fn().mockResolvedValue({ id: 101 }),
      },
    };

    useTransactionMock(tx);

    const result = await service.update(
      42,
      createDto({ visibleId: 42 }),
      'user-1',
    );

    expect(tx.equipment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 101 },
      }),
    );
    expect(upsertEquipment).toHaveBeenCalledWith(tx, 101);
    expect(logEquipmentUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        equipmentId: 101,
        tx,
        userId: 'user-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        manufacturer: 'DMG',
        model: 'CTX',
        visibleId: 42,
      }),
    );
  });

  it('syncs numbering when visible id changes on update', async () => {
    const { service, useTransactionMock, syncSequence } =
      createEquipmentWriteFixture();
    const currentEquipment = createEquipmentWithRelations({
      id: 101,
      visibleId: 42,
    });
    const updatedEquipment = createEquipmentWithRelations({
      id: 101,
      visibleId: 500,
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 101 }]),
      equipment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(currentEquipment)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(updatedEquipment),
        update: jest.fn().mockResolvedValue({ id: 101 }),
      },
    };

    useTransactionMock(tx);

    await service.update(42, createDto({ visibleId: 500 }), 'user-1');

    expect(tx.equipment.findUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        select: { id: true },
        where: { visibleId: 500 },
      }),
    );
    expect(syncSequence).toHaveBeenCalled();
  });

  it('throws conflict when the new visible id already exists on update', async () => {
    const { service, useTransactionMock, syncSequence } =
      createEquipmentWriteFixture();
    const currentEquipment = createEquipmentWithRelations({
      id: 101,
      visibleId: 42,
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 101 }]),
      equipment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(currentEquipment)
          .mockResolvedValueOnce({ id: 202 }),
      },
    };

    useTransactionMock(tx);

    await expect(
      service.update(42, createDto({ visibleId: 500 }), 'user-1'),
    ).rejects.toThrow(ConflictException);

    expect(syncSequence).not.toHaveBeenCalled();
  });

  it('does not sync numbering when visible id stays the same on update', async () => {
    const { service, useTransactionMock, syncSequence } =
      createEquipmentWriteFixture();
    const currentEquipment = createEquipmentWithRelations({
      id: 101,
      visibleId: 42,
    });
    const updatedEquipment = createEquipmentWithRelations({
      id: 101,
      visibleId: 42,
    });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 101 }]),
      equipment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(currentEquipment)
          .mockResolvedValueOnce(updatedEquipment),
        update: jest.fn().mockResolvedValue({ id: 101 }),
      },
    };

    useTransactionMock(tx);

    await service.update(42, createDto({ visibleId: 42 }), 'user-1');

    expect(syncSequence).not.toHaveBeenCalled();
  });

  it('throws not found when updated equipment row is missing', async () => {
    const { service, useTransactionMock } = createEquipmentWriteFixture();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    useTransactionMock(tx);

    await expect(
      service.update(42, createDto({ visibleId: undefined }), 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
