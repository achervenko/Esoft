import { EquipmentStatus } from '@prisma/client';
import type { AuditLogService } from '../audit/audit-log.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EquipmentSearchProjector } from '../search/equipment-search.projector';
import type { IdentityNumberingService } from '../application/numbering/identity-numbering.service';
import { EquipmentWriteService } from './equipment-write.service';

export function createEquipmentWriteFixture() {
  const auditLog = {
    logEquipmentCreated: jest.fn(),
    logEquipmentUpdated: jest.fn(),
  };
  const projector = { upsertEquipment: jest.fn() };
  const numbering = { syncSequence: jest.fn() };
  const referenceValidator = {
    assertCountryExists: jest.fn(),
    assertEquipmentModelExists: jest.fn(),
    assertResponsibleEmployeeIsActive: jest.fn(),
    assertSectionExists: jest.fn(),
  };
  const prisma = {
    equipment: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new EquipmentWriteService(
    auditLog as unknown as AuditLogService,
    projector as unknown as EquipmentSearchProjector,
    numbering as unknown as IdentityNumberingService,
    prisma as unknown as PrismaService,
    referenceValidator,
  );
  function useTransactionMock<TTransaction>(tx: TTransaction) {
    prisma.$transaction.mockImplementation(
      (
        operation: (transaction: TTransaction) => Promise<unknown>,
      ): Promise<unknown> => operation(tx),
    );
  }
  return {
    service,
    prisma,
    useTransactionMock,
    ...auditLog,
    ...projector,
    ...numbering,
    ...referenceValidator,
  };
}

export function createDto(overrides: { visibleId?: number | undefined }) {
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

export function createEquipmentWithRelations(overrides: {
  id: number;
  visibleId: number;
}) {
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
      position: { name: 'Мастер' },
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
  };
}
