import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createIntegrationsCoreContext } from "../integrations/integrations-core-context.mjs";
const require = createRequire(import.meta.url);
const {
  OrdersFlow,
} = require("../../../../../backend/dist/src/orders/orders-flow.js");
const {
  OrdersSyncService,
} = require("../../../../../backend/dist/src/orders/orders-sync.service.js");
const {
  OrdersService,
} = require("../../../../../backend/dist/src/orders/orders.service.js");
export const rawOrder = (patch = {}) => ({
  Ref_Key: randomUUID(),
  Number: "0000-000721",
  IR_Проект: "",
  Date: "2026-09-21T13:59:49",
  Статус: "КОбеспечению",
  Posted: true,
  DeletionMark: false,
  ...patch,
});
export { OrdersSyncService };
export async function createOrdersSyncContext() {
  const c = await createIntegrationsCoreContext({ withOrders: true });
  const state = {
    rows: [rawOrder()],
    broken: false,
    gate: null,
    entered: null,
  };
  const first = state.rows[0];
  const server = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, "Bearer secret");
    const url = new URL(req.url, "http://localhost");
    assert.equal(url.searchParams.has("$filter"), false);
    if (state.gate) {
      state.entered();
      await state.gate;
    }
    const skip = Number(url.searchParams.get("$skip"));
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        state.broken && skip > 0
          ? { invalid: true }
          : { value: state.rows.slice(skip, skip + 200) },
      ),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    new OrdersFlow(c.registry).onModuleInit();
    const source = await c.sources.create(
      {
        name: "Заказы",
        systemType: "ONE_C",
        baseUrl: `http://127.0.0.1:${server.address().port}/`,
        authorization: "Bearer secret",
      },
      c.admin.id,
    );
    await c.sources.configureFlow(
      source.code,
      "orders.customers",
      { isActive: true, configVersion: 1, config: {} },
      c.admin.id,
    );
    const sync = new OrdersSyncService(c.prisma, c.registry),
      service = new OrdersService(c.prisma);
    const refresh = () => sync.sync(source.id, c.admin.id);
    const find = () =>
      c.prisma.customerOrder.findUniqueOrThrow({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: first.Ref_Key,
          },
        },
      });
    return {
      c,
      state,
      first,
      source,
      server,
      sync,
      service,
      refresh,
      find,
      async close() {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await c.close();
      },
    };
  } catch (error) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await c.close();
    throw error;
  }
}
