import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { IntegrationRegistry } from './integration-registry';
import { IntegrationFlowsService } from './integration-flows.service';

export function setup(permissions = ['warehouse.receipts.integration']) {
  const source = {
    id: 'source-id',
    actorUserId: 'system-id',
    systemType: 'ONE_C',
  };
  const flow = {
    flowCode: 'warehouse.receipts',
    configVersion: 1,
    config: {},
    isActive: true,
  };
  const grant = jest.fn().mockResolvedValue({});
  const create = jest.fn().mockResolvedValue(flow);
  const upsert = jest.fn().mockResolvedValue(flow);
  const query = jest.fn().mockResolvedValue([{ role: 'admin', banned: false }]);
  const findFlows = jest.fn().mockResolvedValue([flow]);
  const remove = jest.fn().mockResolvedValue({ count: 0 });
  const tx = {
    $queryRaw: query,
    integrationSource: { findUnique: jest.fn().mockResolvedValue(source) },
    integrationFlow: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create,
      upsert,
      findMany: findFlows,
    },
    systemActorPermission: {
      upsert: grant,
      deleteMany: remove,
    },
  } as unknown as Prisma.TransactionClient;
  const prisma = {
    $transaction: (work: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      work(tx),
  } as unknown as PrismaService;
  const auditWrite = jest.fn().mockResolvedValue(undefined);
  const audit = { writeFieldChanges: auditWrite } as unknown as AuditLogService;
  const registry = new IntegrationRegistry();
  registry.registerFlow({
    flowCode: flow.flowCode,
    name: 'Receipts',
    owner: 'warehouse',
    systemTypes: ['ONE_C'],
    configVersions: [1],
    incomingActions: ['event:create'],
    actorPermissions: permissions,
    validateConfig: () => {},
    validateEvent: () => {},
    handle: () => Promise.resolve(),
  });
  return {
    service: new IntegrationFlowsService(prisma, registry, audit),
    source,
    flow,
    tx,
    grant,
    create,
    upsert,
    query,
    auditWrite,
    registry,
    findFlows,
    remove,
  };
}
