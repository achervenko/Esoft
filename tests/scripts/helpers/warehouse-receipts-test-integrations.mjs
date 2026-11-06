import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  load = (p) => require("../../../backend/dist/src/" + p);
export function createReceiptTestIntegrations(
  prisma,
  audit,
  machineKeys,
  importer,
) {
  const { IntegrationRegistry } = load("integrations/integration-registry.js"),
    { OneCIntegrationAdapter } = load("integrations/adapters/one-c.adapter.js"),
    { IntegrationSourcesService } = load(
      "integrations/integration-sources.service.js",
    ),
    { IntegrationKeysService } = load(
      "integrations/integration-keys.service.js",
    ),
    { IntegrationEventsService } = load(
      "integrations/integration-events.service.js",
    ),
    { IntegrationWorkerService } = load(
      "integrations/integration-worker.service.js",
    ),
    { WarehouseReceiptIntegrationHandler } = load(
      "warehouse/receipt-integration/receipt-integration.handler.js",
    );
  const { IntegrationFlowsService } = load(
    "integrations/integration-flows.service.js",
  );
  const registry = new IntegrationRegistry();
  new OneCIntegrationAdapter(registry).onModuleInit();
  new WarehouseReceiptIntegrationHandler(
    prisma,
    importer,
    registry,
  ).onModuleInit();
  const coreSources = new IntegrationSourcesService(
      prisma,
      registry,
      audit,
      new IntegrationFlowsService(prisma, registry, audit),
    ),
    coreKeys = new IntegrationKeysService(prisma, machineKeys, registry, audit),
    coreEvents = new IntegrationEventsService(
      prisma,
      machineKeys,
      audit,
      registry,
    ),
    coreWorker = new IntegrationWorkerService(prisma, registry);
  return { coreSources, coreKeys, coreEvents, coreWorker, registry };
}
