import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { IntegrationRegistry } from './integration-registry';
import { IntegrationFlowsService } from './integration-flows.service';

import { setup } from './integration-flows.test-helpers';

it.each(['create', 'configure'])(
  'grants source-scoped permissions during %s',
  async (operation) => {
    const s = setup();
    if (operation === 'create')
      await s.service.createForSource(s.tx, s.source, [s.flow]);
    else {
      await expect(
        s.service.configureFlow(
          'source-code',
          s.flow.flowCode,
          { configVersion: 1, config: {}, isActive: true },
          'admin-id',
        ),
      ).resolves.toEqual(s.flow);
      expect(s.auditWrite).toHaveBeenCalledWith(
        expect.objectContaining({
          tx: s.tx,
          entityType: 'integration_flow',
          userId: 'admin-id',
        }),
      );
      expect(s.query).toHaveBeenCalledTimes(2);
    }
    expect(s.grant).toHaveBeenCalledWith({
      where: {
        sourceId_actorUserId_permission: {
          sourceId: s.source.id,
          actorUserId: s.source.actorUserId,
          permission: 'warehouse.receipts.integration',
        },
      },
      create: {
        sourceId: s.source.id,
        actorUserId: s.source.actorUserId,
        permission: 'warehouse.receipts.integration',
      },
      update: {},
    });
  },
);
it.each(['create', 'configure'])(
  'rejects unknown actor permissions during %s',
  async (operation) => {
    const s = setup(['unknown.permission']);
    const work =
      operation === 'create'
        ? s.service.createForSource(s.tx, s.source, [s.flow])
        : s.service.configureFlow(
            'source-code',
            s.flow.flowCode,
            { configVersion: 1, config: {}, isActive: true },
            'admin-id',
          );
    await expect(work).rejects.toBeDefined();
    expect(s.grant).not.toHaveBeenCalled();
  },
);
it('rejects duplicate flows and unsupported config versions', async () => {
  const s = setup();
  await expect(
    s.service.createForSource(s.tx, s.source, [s.flow, s.flow]),
  ).rejects.toBeDefined();
  await expect(
    s.service.createForSource(s.tx, s.source, [
      { ...s.flow, configVersion: 2 },
    ]),
  ).rejects.toMatchObject({ code: 'FLOW_CONFIG_UNSUPPORTED' });
});

it('preserves unchanged flows when their handler is unavailable but rejects changes', async () => {
  const previous = {
    sourceId: 'source-id',
    flowCode: 'warehouse.receipts',
    configVersion: 1,
    config: { nested: { one: 1, two: 2 } },
    isActive: true,
  };
  const tx = {
    integrationFlow: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(previous),
      findMany: jest.fn().mockResolvedValue([previous]),
    },
    systemActorPermission: { upsert: jest.fn(), deleteMany: jest.fn() },
  } as unknown as Prisma.TransactionClient;
  const registry = new IntegrationRegistry();
  const service = new IntegrationFlowsService(
    {} as PrismaService,
    registry,
    {} as AuditLogService,
  );
  const source = { id: 'source-id', actorUserId: 'actor', systemType: 'ONE_C' };
  const value = {
    flowCode: previous.flowCode,
    configVersion: 1,
    config: { nested: { two: 2, one: 1 } },
    isActive: true,
  };
  await expect(
    service.updateForSource(tx, source, [value], 'admin'),
  ).resolves.toBeUndefined();
  await expect(
    service.updateForSource(
      tx,
      source,
      [{ ...value, isActive: false }],
      'admin',
    ),
  ).rejects.toMatchObject({ code: 'HANDLER_UNAVAILABLE' });
});

it.each([[[]], [['warehouse.receipts']], [['test.other-flow']]])(
  'deactivates omitted flows before reconciling permissions: %j',
  async (codes) => {
    const s = setup();
    s.registry.registerFlow({
      ...s.registry.findFlow(s.flow.flowCode)!,
      flowCode: 'test.other-flow',
    });
    const updateMany = jest.spyOn(s.tx.integrationFlow, 'updateMany');
    await s.service.updateForSource(
      s.tx,
      s.source,
      codes.map((flowCode) => ({ ...s.flow, flowCode })),
      'admin',
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        sourceId: s.source.id,
        flowCode: { notIn: codes },
        isActive: true,
      },
      data: { isActive: false },
    });
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      s.findFlows.mock.invocationCallOrder[0],
    );
  },
);
