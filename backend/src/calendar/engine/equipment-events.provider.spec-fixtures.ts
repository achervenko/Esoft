import { EventExtensionCode, EventSource, EventStatus } from '@prisma/client';
import { EquipmentEventsProvider } from './equipment-events.provider';

export function createProvider() {
  const eventsQueryService = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const provider = new EquipmentEventsProvider(eventsQueryService as never);

  return { eventsQueryService, provider };
}

export function eventResponse(overrides = {}) {
  return {
    checklists: [],
    extension: {
      code: EventExtensionCode.EQUIPMENT,
      equipment: {
        location: 'Цех 1',
        name: 'Компрессор',
        serialNumber: 'SN-1001',
        visibleId: 1001,
      },
      maintenanceType: {
        name: 'ТО-1',
      },
    },
    extensionCode: EventExtensionCode.EQUIPMENT,
    factDate: null,
    id: 1,
    note: null,
    plannedDate: '2026-08-01',
    responsibles: [],
    source: EventSource.MANUAL,
    status: EventStatus.CREATED,
    title: 'ТО',
    version: 1,
    ...overrides,
  };
}
