import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const { Prisma } = createRequire(import.meta.url)("@prisma/client");

export async function adversarialReceiptHttp(c, http, t) {
  let sourceSystem = c.sourceSystem + "-http-deep";
  let document = c.source(),
    fetched = 0;
  const server = createServer((req, res) => {
    fetched++;
    assert.equal(req.headers.authorization, "Bearer isolated-outgoing-secret");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(document));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  let prefix = "/api/integrations/sources";
  const config = {
    baseUrl: `http://127.0.0.1:${server.address().port}/`,
    authorization: "Bearer isolated-outgoing-secret",
    name: "HTTP integration",
    systemType: "ONE_C",
    flows: [
      {
        flowCode: "warehouse.receipts",
        configVersion: 1,
        config: {},
        isActive: true,
      },
    ],
  };
  const flowCode = "warehouse.receipts";
  let key, receipt, sourceId;
  try {
    await t.test(
      "retired receipt integration HTTP routes are absent",
      async () => {
        for (const [method, path] of [
          ["GET", "receipt-integration/sources"],
          ["PUT", "receipt-integration/sources/retired"],
          ["POST", "receipt-integration/sources/retired/events"],
          ["GET", "receipt-integration/events"],
        ])
          await http.request(method, path, {
            role: "admin",
            body: method === "GET" ? undefined : {},
            expected: 404,
          });
      },
    );
    await t.test(
      "real sessions and source key permissions at the HTTP boundary",
      async () => {
        await http.request("POST", prefix, { body: config, expected: 401 });
        await http.request("POST", prefix, {
          role: "keeper",
          body: config,
          expected: 403,
        });
        const created = await http.request("POST", prefix, {
          role: "admin",
          body: config,
          expected: 201,
        });
        sourceSystem = created.body.code;
        prefix = `/api/integrations/sources/${sourceSystem}`;
        ({ id: sourceId } = await c.prisma.integrationSource.findUniqueOrThrow({
          where: { code: sourceSystem },
          select: { id: true },
        }));
        const link = {
          externalId: document.warehouse.id,
          warehouseId: String(c.warehouse.id),
        };
        await http.request(
          "PUT",
          `integrations/sources/${sourceSystem}/warehouses`,
          {
            role: "keeper",
            body: link,
            expected: 403,
          },
        );
        await http.request(
          "PUT",
          `integrations/sources/${sourceSystem}/warehouses`,
          {
            role: "admin",
            body: link,
            expected: 200,
          },
        );
        const count = await c.prisma.apiKey.count();
        for (const body of [
          null,
          [],
          {},
          { name: "" },
          { name: "key", expiresIn: 0 },
          { name: "key", expiresIn: "86400" },
          { name: "key", metadata: { sourceSystem: "forged" } },
          { name: "key", permissions: { admin: ["*"] } },
        ])
          await http.request("POST", prefix + "/keys", {
            role: "admin",
            body,
            expected: 400,
          });
        assert.equal(await c.prisma.apiKey.count(), count);
        const issued = await http.request("POST", prefix + "/keys", {
          role: "admin",
          body: {
            name: "Real HTTP integration key",
            flows: { "warehouse.receipts": ["event:create"] },
          },
          expected: 201,
        });
        key = issued.body;
        assert.equal(issued.headers.get("cache-control"), "no-store");
        assert.equal(
          (await c.prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } }))
            .enabled,
          true,
        );
        for (const [method, path] of [
          ["GET", "/api/integrations/sources"],
          ["GET", prefix + "/keys"],
          ["POST", prefix + "/keys"],
          ["POST", prefix + `/keys/${key.id}/revoke`],
          ["GET", "/api/integrations/events"],
          ["POST", "/api/integrations/events/1/retry"],
        ])
          await http.request(method, path, {
            token: key.key,
            ...(["POST"].includes(method) ? { body: {} } : {}),
            expected: 401,
          });
        const listed = await http.request("GET", prefix + "/keys", {
          role: "admin",
          expected: 200,
        });
        assert.ok(listed.body.every((row) => !("key" in row)));
        const audit = await c.prisma.auditLog.findMany({
          where: { entityStringId: key.id },
        });
        assert.equal(audit.length, 1);
        assert.ok(!JSON.stringify(audit).includes(key.key));
        c.trace("assertion", {
          name: "issued key has a committed audit, never a user session or admin permission",
        });
      },
    );
    await t.test(
      "20 duplicate HTTP deliveries and 6 workers import exactly once without stock",
      async () => {
        const event = {
          eventId: randomUUID(),
          objectId: document.id,
          type: "RECEIPT_CHANGED",
          version: "1",
        };
        await http.request(
          "POST",
          prefix + "/flows/warehouse.receipts/events",
          {
            role: "admin",
            body: event,
            expected: 401,
          },
        );
        for (const body of [
          {},
          { ...event, version: 1 },
          { ...event, version: "9223372036854775808" },
          { ...event, actorUserId: c.keeper.id },
          { ...event, objectId: ".." },
          { ...event, eventId: "not-uuid" },
        ])
          await http.request(
            "POST",
            prefix + "/flows/warehouse.receipts/events",
            {
              token: key.key,
              body,
              expected: 400,
            },
          );
        const before = await c.quantity();
        await Promise.all(
          Array.from({ length: 20 }, () =>
            http.request("POST", prefix + "/flows/warehouse.receipts/events", {
              token: key.key,
              body: event,
              expected: 202,
            }),
          ),
        );
        const events = await c.prisma.integrationEvent.findMany({
          where: { sourceId, flowCode },
        });
        assert.equal(events.length, 1);
        assert.equal(events[0].eventId, event.eventId);
        await Promise.all(
          Array.from({ length: 6 }, () => c.coreWorker.process(events[0].id)),
        );
        assert.equal(fetched, 1);
        assert.equal(
          (
            await c.prisma.integrationEvent.findUniqueOrThrow({
              where: {
                sourceId_flowCode_eventId: {
                  sourceId,
                  flowCode,
                  eventId: event.eventId,
                },
              },
            })
          ).status,
          "PROCESSED",
        );
        const row = await c.prisma.warehouseReceipt.findFirstOrThrow({
          where: { sourceSystem },
        });
        receipt = (
          await http.request("GET", `receipts/${row.id}`, {
            role: "keeper",
            expected: 200,
          })
        ).body;
        assert.equal(receipt.status, "RECEIVED");
        assert.equal(receipt.lines[0].itemId, null);
        assert.equal(await c.quantity(), before);
        await http.request(
          "POST",
          prefix + "/flows/warehouse.receipts/events",
          {
            token: key.key,
            body: { ...event, version: "2" },
            expected: 409,
          },
        );
        c.trace("assertion", {
          name: "20 deliveries => 1 event => 1 document; stock unchanged",
          receiptId: receipt.id,
          stock: before,
        });
      },
    );
    await t.test(
      "HTTP mapping, precise placement, immutable history and source cancellation conflict",
      async () => {
        const base = `receipts/${receipt.id}`;
        assert.equal(receipt.warehouseId, String(c.warehouse.id));
        await http.request(
          "POST",
          base + `/lines/${receipt.lines[0].id}/item-link`,
          {
            role: "keeper",
            body: { itemId: String(c.item.id) },
            expected: 201,
          },
        );
        const before = await c.quantity();
        const expectedQuantity = new Prisma.Decimal(before)
          .plus("3.125")
          .toString();
        const payload = {
          requestKey: randomUUID(),
          storageLocationId: String(c.location.id),
          quantity: "3.125",
        };
        const path = base + `/lines/${receipt.lines[0].id}/placements`;
        const placed = await http.request("POST", path, {
          role: "keeper",
          body: payload,
          expected: 201,
        });
        const auditCount = await c.prisma.auditLog.count();
        await http.request("POST", path, {
          role: "keeper",
          body: payload,
          expected: 201,
        });
        assert.equal(await c.prisma.auditLog.count(), auditCount);
        assert.equal(await c.quantity(), expectedQuantity);
        await http.request("POST", path, {
          role: "keeper",
          body: { ...payload, quantity: "3.126" },
          expected: 409,
        });
        const history = JSON.stringify(placed.body);
        document = { ...document, version: "2", status: "CANCELLED" };
        const event = {
          eventId: randomUUID(),
          objectId: document.id,
          version: "2",
          type: "RECEIPT_CANCELLED",
        };
        await http.request(
          "POST",
          prefix + "/flows/warehouse.receipts/events",
          {
            token: key.key,
            body: event,
            expected: 202,
          },
        );
        const queued = await c.prisma.integrationEvent.findUniqueOrThrow({
          where: {
            sourceId_flowCode_eventId: {
              sourceId,
              flowCode,
              eventId: event.eventId,
            },
          },
        });
        await c.coreWorker.process(queued.id);
        const conflicted = (
          await http.request("GET", base, { role: "keeper", expected: 200 })
        ).body;
        assert.equal(conflicted.conflict, "SOURCE_CANCELLED_AFTER_PLACEMENT");
        await http.request("POST", path, {
          role: "keeper",
          body: { ...payload, requestKey: randomUUID() },
          expected: 409,
        });
        assert.equal(await c.quantity(), expectedQuantity);
        assert.equal(
          JSON.stringify(conflicted.lines[0].placements[0]),
          history,
        );
        await http.request("POST", prefix + `/keys/${key.id}/revoke`, {
          role: "admin",
          body: {},
          expected: 201,
        });
        await http.request(
          "POST",
          prefix + "/flows/warehouse.receipts/events",
          {
            token: key.key,
            body: event,
            expected: 401,
          },
        );
        c.trace("assertion", {
          name: "source cancellation cannot undo stock or placement history",
          quantityDelta: "3.125",
        });
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise((ok) => server.close(ok));
  }
}
