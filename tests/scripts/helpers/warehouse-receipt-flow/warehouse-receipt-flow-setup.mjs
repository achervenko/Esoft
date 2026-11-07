import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { cp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";
import { createReceiptTestContext } from "../warehouse-receipts-test-context.mjs";
const require = createRequire(import.meta.url);
export async function attachWarehousePackage(c) {
  const { prisma, registry, project, root, url } = c;
  const [before] =
    await prisma.$queryRaw`SELECT to_regclass('warehouse_receipts')::text AS table_name`;
  assert.equal(before.table_name, null);
  for (const id of ["orders", "warehouse"])
    await cp(
      join(project, "backend/prisma/packages", id),
      join(root, "backend/prisma/packages", id),
      { recursive: true },
    );
  await writeFile(
    join(root, "database-packages.json"),
    '{"modules":["warehouse"]}',
  );
  const migrated = await runPackageMigrations({
    projectRoot: root,
    databaseUrl: url,
    operation: "deploy",
    output: { log() {} },
  });
  assert.equal(migrated.ok, true, migrated.stdout + migrated.stderr);
  const warehouse = await createReceiptTestContext(prisma);
  const { WarehouseReceiptIntegrationHandler } = require(
    join(
      project,
      "backend/dist/src/warehouse/receipt-integration/receipt-integration.handler.js",
    ),
  );
  const { ReceiptIntegrationWarehousesService } = require(
    join(
      project,
      "backend/dist/src/warehouse/receipts/receipt-source-warehouses.service.js",
    ),
  );
  const warehouseLinks = new ReceiptIntegrationWarehousesService(
    prisma,
    warehouse.audit,
  );
  new WarehouseReceiptIntegrationHandler(
    prisma,
    warehouse.importer,
    registry,
  ).onModuleInit();
  return { ...c, warehouse, warehouseLinks };
}

export async function createReceiptFlowContext(c) {
  const context = {
    ...c,
    coreSource: c.source,
    document: c.warehouse.source(),
    calls: 0,
  };
  delete context.document.version;
  const server = createServer((req, res) => {
    context.calls++;
    assert.equal(req.headers.authorization, "Bearer source-credential");
    assert.equal(req.url, "/receipts/" + context.document.id);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(context.document));
  });
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", ok);
  });
  const close = () => new Promise((resolve) => server.close(resolve));
  const { sources, keys, admin } = c;
  try {
    const source = await sources.create(
      {
        name: "1С — склад",
        systemType: "ONE_C",
        baseUrl: `http://127.0.0.1:${server.address().port}/`,
        authorization: "Bearer source-credential",
      },
      admin.id,
    );
    await sources.configureFlow(
      source.code,
      "warehouse.receipts",
      { isActive: true, configVersion: 1, config: {} },
      admin.id,
    );
    const key = await keys.create(
      source.code,
      {
        name: "receipt",
        flows: { "warehouse.receipts": ["event:create"] },
      },
      admin.id,
    );
    Object.assign(context, { source, key, close });
    return context;
  } catch (error) {
    await close();
    throw error;
  }
}
