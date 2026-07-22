import { ConflictException, NotFoundException } from '@nestjs/common';
import { EquipmentStatus, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentSearchProjector } from '../search/equipment-search.projector';
import { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { EquipmentReferenceValidatorService } from './equipment-reference-validator.service';
import { EquipmentWriteService } from './equipment-write.service';

describe('EquipmentWriteService', () => {
  let service: EquipmentWriteService;
  let auditLog: jest.Mocked<AuditLogService>;
  let equipmentSearchProjector: jest.Mocked<EquipmentSearchProjector>;
  let numbering: jest.Mocked<IdentityNumberingService>;
  let prisma: {
    equipment: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let referenceValidator: jest.Mocked<EquipmentReferenceValidatorService>;

  beforeEach(() => {
    auditLog = {
      logEquipmentCreated: jest.fn(),
      logEquipmentUpdated: jest.fn(),
    } as never;
    equipmentSearchProjector = {
      upsertEquipment: jest.fn(),
    } as never;
    numbering = {
      syncSequence: jest.fn(),
    } as never;
    prisma = {
      equipment: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    referenceValidator = {
      assertCountryExists: jest.fn(),
      assertEquipmentModelExists: jest.fn(),
      assertResponsibleEmployeeIsActive: jest.fn(),
      assertSectionExists: jest.fn(),
    } as never;

    service = new EquipmentWriteService(
      auditLog,
      equipmentSearchProjector,
      numbering,
      prisma as PrismaService,
      referenceValidator,
    );
  });

  it('creates equipment and returns a presented card', async () => {
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

    prisma.$transaction.mockImplementation(async (operation) => operation(tx as never));

    const result = await service.create(createDto({ visibleId: 500 }), 'user-1');

    expect(referenceValidator.assertEquipmentModelExists).toHaveBeenCalledWith(
      tx,
      2,
    );
    expect(referenceValidator.assertResponsibleEmployeeIsActive).toHaveBeenCalledWith(
      tx,
      7,
    );
    expect(referenceValidator.assertSectionExists).toHaveBeenCalledWith(tx, 3);
    expect(referenceValidator.assertCountryExists).toHaveBeenCalledWith(
      tx,
      null,
    );
    expect(auditLog.logEquipmentCreated).toHaveBeenCalledWith(101, 'user-1', tx);
    expect(equipmentSearchProjector.upsertEquipment).toHaveBeenCalledWith(
      tx,
      101,
    );
    expect(numbering.syncSequence).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        manufacturer: 'DMG',
        model: 'CTX',
        visibleId: 500,
      }),
    );
  });

  it('does not sync numbering when visibleId is not provided manually', async () => {
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

    prisma.$transaction.mockImplementation(async (operation) => operation(tx as never));

    await service.create(createDto({ visibleId: undefined }), 'user-1');

    expect(numbering.syncSequence).not.toHaveBeenCalled();
  });

  it('throws conflict when a custom visible id already exists on create', async () => {
    prisma.equipment.findUnique.mockResolvedValue({ id: 1 });

    await expect(service.create(createDto({ visibleId: 500 }), 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('maps Prisma unique conflicts from transaction failures', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        clientVersion: 'test',
        code: 'P2002',
        meta: { target: ['inventory_number'] },
      }),
    );

    await expect(service.create(createDto({ visibleId: undefined }), 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('updates equipment, refreshes search, writes audit and returns a presented card', async () => {
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

    prisma.$transaction.mockImplementation(async (operation) => operation(tx as never));

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
    expect(equipmentSearchProjector.upsertEquipment).toHaveBeenCalledWith(
      tx,
      101,
    );
    expect(auditLog.logEquipmentUpdated).toHaveBeenCalledWith(
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

    prisma.$transaction.mockImplementation(async (operation) => operation(tx as never));

    await service.update(42, createDto({ visibleId: 500 }), 'user-1');

    expect(tx.equipment.findUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        select: { id: true },
        where: { visibleId: 500 },
      }),
    );
    expect(numbering.syncSequence).toHaveBeenCalled();
  });

  it('throws conflict when the new visible id already exists on update', async () => {
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

    prisma.$transaction.mockImplementation(async (operation) => operation(tx as never));

    await expect(
      service.update(42, createDto({ visibleId: 500 }), 'user-1'),
    ).rejects.toThrow(ConflictException);

    expect(numbering.syncSequence).not.toHaveBeenCalled();
  });

  it('does not sync numbering when visible id stays the same on update', async () => {
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

    prisma.$transaction.mockImplementation(async (operation) => operation(tx as never));

    await service.update(42, createDto({ visibleId: 42 }), 'user-1');

    expect(numbering.syncSequence).not.toHaveBeenCalled();
  });

  it('throws not found when updated equipment row is missing', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    prisma.$transaction.mockImplementation(async (operation) => operation(tx as never));

    await expect(service.update(42, createDto({ visibleId: undefined }), 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

function createDto(overrides: { visibleId?: number | undefined }) {
  return {
    inventoryNumber: 'INV-001',
    issueDate: '11.02.2020',
    modelId: 2,
    name: 'Станок',
    responsibleEmployeeId: 7,
    sectionId: 3,
    status: EquipmentStatus.ACTIVE,
    visibleId: overrides.visibleId,
  };
}

function createEquipmentWithRelations(
  overrides: { id: number; visibleId: number },
) {
  return {
    commissioningDate: new Date(Date.UTC(2020, 1, 10)),
    country: { name: 'Германия' },
    countryId: 5,
    id: overrides.id,
    inventoryNumber: 'INV-001',
    issueDate: new Date(Date.UTC(2020, 1, 11)),
    manufactureYear: 2019,
    model: {
      manufacturer: { name: 'DMG' },
      name: 'CTX',
    },
    modelId: 2,
    name: 'Станок',
    notes: null,
    operationText: null,
    responsibleEmployee: {
      firstName: 'Иван',
      lastName: 'Иванов',
      middleName: 'Иванович',
      position: 'Мастер',
    },
    responsibleEmployeeId: 7,
    section: {
      name: 'Участок 1',
      workshop: {
        name: 'Цех 1',
      },
    },
    sectionId: 3,
    serialNumber: null,
    specifications: null,
    status: EquipmentStatus.ACTIVE,
    visibleId: overrides.visibleId,
  } as never;
}
