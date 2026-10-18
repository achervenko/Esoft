import {
  getEquipmentEventExtensionAuditSnapshot,
  writeEquipmentEventExtensionCreatedAudit,
  writeEquipmentEventExtensionUpdatedAudit,
} from '../equipment-event-extension/equipment-event-extension.audit';
import { EquipmentEventExtensionAdapter } from '../equipment-event-extension/equipment-event-extension.adapter';
import { EquipmentEventExtensionCreate } from '../equipment-event-extension/equipment-event-extension.create';
import { EquipmentEventExtensionQuery } from '../equipment-event-extension/equipment-event-extension.query';
import { EquipmentEventExtensionUpdate } from '../equipment-event-extension/equipment-event-extension.update';
import { EquipmentEventExtensionValidation } from '../equipment-event-extension/equipment-event-extension.validation';
import { EventExtensionRegistry } from './event-extensions/event-extension.registry';
import type {
  CreateEventActor,
  CreateEventCommand,
  EventCreateOptions,
} from './events-create.types';
import type { EventsUpdateService } from './events-update.service';
import { EventsService } from './events.service';

export const getEquipmentEventExtensionAuditSnapshotMock =
  getEquipmentEventExtensionAuditSnapshot as jest.MockedFunction<
    typeof getEquipmentEventExtensionAuditSnapshot
  >;
export const writeEquipmentEventExtensionCreatedAuditMock =
  writeEquipmentEventExtensionCreatedAudit as jest.MockedFunction<
    typeof writeEquipmentEventExtensionCreatedAudit
  >;
export const writeEquipmentEventExtensionUpdatedAuditMock =
  writeEquipmentEventExtensionUpdatedAudit as jest.MockedFunction<
    typeof writeEquipmentEventExtensionUpdatedAudit
  >;

export function createService() {
  const checklistCreator = {
    createEventChecklists: jest.fn(),
  };
  const equipmentExtensionService = {
    assertChecklistTemplatesAllowed: jest.fn(),
    create: jest.fn(),
    prepareCreate: jest.fn().mockResolvedValue({
      equipmentId: 100,
      eventTypeId: 10,
      executionType: 'INTERNAL',
      maintenanceSettingId: 50,
    }),
    prepareUpdateCreated: jest.fn().mockResolvedValue({
      equipmentId: undefined,
      eventTypeId: undefined,
      finalMaintenanceSettingId: 50,
      maintenanceSetting: undefined,
    }),
    updateCreated: jest.fn(),
  };
  const detailResponse = { id: 1, title: 'Updated event' };
  const createEvent = jest
    .fn<
      Promise<number>,
      [CreateEventCommand, CreateEventActor, EventCreateOptions?]
    >()
    .mockResolvedValue(25);
  const eventsCreateService = {
    create: createEvent,
  };
  const queryService = {
    findAll: jest.fn().mockResolvedValue([detailResponse]),
    findOne: jest.fn().mockResolvedValue(detailResponse),
    findResponsibleUsers: jest.fn().mockResolvedValue({
      users: [],
    }),
  };
  const lifecycleService = {
    cancel: jest.fn().mockResolvedValue({ eventId: 1 }),
    complete: jest.fn().mockResolvedValue({ eventId: 1 }),
    start: jest.fn().mockResolvedValue({ eventId: 1 }),
  };
  const updateCreated: jest.MockedFunction<
    EventsUpdateService['updateCreated']
  > = jest.fn().mockResolvedValue({
    eventId: 1,
    updated: true,
  });
  const updateService = {
    updateCreated,
  };
  const extensionRegistry = new EventExtensionRegistry([
    createEquipmentEventExtensionAdapter(equipmentExtensionService),
  ]);
  const service = new EventsService(
    checklistCreator as never,
    eventsCreateService as never,
    extensionRegistry,
    lifecycleService as never,
    queryService as never,
    updateService as never,
  );

  return {
    checklistCreator,
    detailResponse,
    equipmentExtensionService,
    eventsCreateService,
    lifecycleService,
    queryService,
    service,
    updateService,
  };
}

function createEquipmentEventExtensionAdapter(
  equipmentExtensionService: unknown,
): EquipmentEventExtensionAdapter {
  const validation = new EquipmentEventExtensionValidation();

  return new EquipmentEventExtensionAdapter(
    new EquipmentEventExtensionCreate(equipmentExtensionService as never),
    new EquipmentEventExtensionUpdate(equipmentExtensionService as never),
    new EquipmentEventExtensionQuery(validation),
    validation,
  );
}

export function resetEventsServiceMocks() {
  jest.clearAllMocks();
  getEquipmentEventExtensionAuditSnapshotMock.mockResolvedValue({
    equipmentName: 'Pump',
    equipmentVisibleId: 1001,
    eventTypeCode: 'MAINTENANCE',
    eventTypeId: 10,
    eventTypeName: 'Maintenance',
    executionType: 'INTERNAL',
    id: 25,
    maintenanceSettingId: 50,
  });
}
