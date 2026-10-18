jest.mock(
  '../equipment-event-extension/equipment-event-extension.audit',
  () => ({
    getEquipmentEventExtensionAuditSnapshot: jest.fn(),
    writeEquipmentEventExtensionCreatedAudit: jest.fn(),
    writeEquipmentEventExtensionUpdatedAudit: jest.fn(),
  }),
);

import {
  createService,
  resetEventsServiceMocks,
} from './events-service.spec-fixtures';

describe('EventsService delegation', () => {
  beforeEach(resetEventsServiceMocks);

  it('delegates findOne to query service', async () => {
    const { detailResponse, queryService, service } = createService();

    await expect(service.findOne(1)).resolves.toBe(detailResponse);

    expect(queryService.findOne).toHaveBeenCalledWith(1);
  });

  it('delegates findAll to query service', async () => {
    const { detailResponse, queryService, service } = createService();
    const query = {
      limit: 50,
      offset: 0,
      where: {
        extensionCode: null,
      },
    };

    await expect(service.findAll(query)).resolves.toEqual([detailResponse]);

    expect(queryService.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates responsible users to query service', async () => {
    const { queryService, service } = createService();

    await expect(service.findResponsibleUsers()).resolves.toEqual({
      users: [],
    });

    expect(queryService.findResponsibleUsers).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      data: { version: 1 },
      methodName: 'start',
    },
    {
      data: {
        factDate: new Date('2026-08-01T00:00:00.000Z'),
        version: 1,
      },
      methodName: 'complete',
    },
    {
      data: { version: 1 },
      methodName: 'cancel',
    },
  ] as const)(
    'delegates $methodName lifecycle operation and returns detail response',
    async ({ data, methodName }) => {
      const { detailResponse, lifecycleService, queryService, service } =
        createService();

      await expect(service[methodName](1, data, 'user-1')).resolves.toBe(
        detailResponse,
      );

      expect(lifecycleService[methodName]).toHaveBeenCalledWith(
        1,
        data,
        'user-1',
      );
      expect(queryService.findOne).toHaveBeenCalledWith(1);
    },
  );
});
