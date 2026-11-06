import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-receipts-test-context.mjs";
export async function receiptsEvents(c, t) {
  await t.test(
    "durable event delivery, targeted fetch, retry and out-of-order notifications",
    async () => {
      let sourceSystem = c.sourceSystem + "-http";
      let document = c.source(),
        requests = 0,
        fail = false;
      const server = createServer((req, res) => {
        requests++;
        assert.equal(req.headers.authorization, "Bearer source-test");
        assert.equal(req.url, "/receipts/" + document.id);
        res.setHeader("Content-Type", "application/json");
        if (fail) {
          res.writeHead(503);
          res.end("{}");
          return;
        }
        res.end(JSON.stringify(document));
      });
      await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
      try {
        const configuredSource = await c.coreSources.create(
          {
            name: sourceSystem,
            systemType: "ONE_C",
            flows: [
              {
                flowCode: "warehouse.receipts",
                configVersion: 1,
                config: {},
                isActive: true,
              },
            ],
            baseUrl: `http://127.0.0.1:${server.address().port}/`,
            authorization: "Bearer source-test",
          },
          c.admin.id,
        );
        sourceSystem = configuredSource.code;
        const sourceId = configuredSource.id;
        await c.integrationWarehouses.save(
          sourceSystem,
          {
            externalId: document.warehouse.id,
            warehouseId: String(c.warehouse.id),
          },
          c.admin.id,
        );
        const systemActor = await c.prisma.user.findUniqueOrThrow({
          where: { id: configuredSource.actorUserId },
          include: { accounts: true, sessions: true },
        });
        assert.equal(systemActor.role, "system:integration");
        assert.equal(systemActor.name, configuredSource.name);
        assert.equal(systemActor.accounts.length, 0);
        assert.equal(systemActor.sessions.length, 0);
        const issued = await c.coreKeys.create(
          sourceSystem,
          {
            flows: { "warehouse.receipts": ["event:create"] },
            name: "1C test",
          },
          c.admin.id,
        );
        const authorization = `Bearer ${issued.key}`;
        const event = {
          eventId: randomUUID(),
          objectId: document.id,
          type: "RECEIPT_CHANGED",
          version: "1",
        };
        await c.coreEvents.accept(
          sourceSystem,
          "warehouse.receipts",
          event,
          authorization,
        );
        await c.coreEvents.accept(
          sourceSystem,
          "warehouse.receipts",
          event,
          authorization,
        );
        await assert.rejects(
          c.coreEvents.accept(
            sourceSystem,
            "warehouse.receipts",
            { ...event, version: "2" },
            authorization,
          ),
          code("INTEGRATION_EVENT_CONFLICT"),
        );
        let stored = await c.prisma.integrationEvent.findUnique({
          where: {
            sourceId_flowCode_eventId: {
              sourceId,
              flowCode: "warehouse.receipts",
              eventId: event.eventId,
            },
          },
        });
        assert.equal(stored.status, "PENDING");
        await c.coreWorker.process(stored.id);
        assert.equal(requests, 1);
        const r = await c.prisma.warehouseReceipt.findUnique({
          where: {
            source_sourceSystem_sourceOperationId: {
              source: "ONE_C",
              sourceSystem,
              sourceOperationId: document.id,
            },
          },
        });
        assert.ok(r);
        assert.equal(r.status, "RECEIVED");
        await c.coreEvents.accept(
          sourceSystem,
          "warehouse.receipts",
          { ...event, eventId: randomUUID() },
          authorization,
        );
        await c.coreWorker.drain();
        assert.equal(requests, 2);
        document = { ...document, version: "2" };
        const second = { ...event, eventId: randomUUID(), version: "2" };
        await c.coreEvents.accept(
          sourceSystem,
          "warehouse.receipts",
          second,
          authorization,
        );
        stored = await c.prisma.integrationEvent.findUnique({
          where: {
            sourceId_flowCode_eventId: {
              sourceId,
              flowCode: "warehouse.receipts",
              eventId: second.eventId,
            },
          },
        });
        fail = true;
        await c.coreWorker.process(stored.id);
        stored = await c.prisma.integrationEvent.findUnique({
          where: { id: stored.id },
        });
        assert.equal(stored.status, "PENDING");
        assert.equal(stored.lastErrorCode, "ONE_C_HTTP_503");
        assert.ok(stored.nextAttemptAt > stored.receivedAt);
        fail = false;
        await c.prisma.integrationEvent.update({
          where: { id: stored.id },
          data: { nextAttemptAt: new Date(0) },
        });
        await c.coreWorker.drain();
        assert.equal(
          (
            await c.prisma.integrationEvent.findUnique({
              where: { id: stored.id },
            })
          ).status,
          "PROCESSED",
        );
        const before = requests;
        await c.coreEvents.accept(
          sourceSystem,
          "warehouse.receipts",
          { ...event, eventId: randomUUID() },
          authorization,
        );
        await c.coreWorker.drain();
        assert.equal(requests, before + 1);
        const src = await c.prisma.integrationSource.findUnique({
          where: { code: sourceSystem },
        });
        assert.ok(!src.authorizationEncrypted.includes("source-test"));
        const storedKey = await c.prisma.apiKey.findUnique({
          where: { id: issued.id },
        });
        assert.notEqual(storedKey.key, issued.key);
      } finally {
        server.closeAllConnections();
        await new Promise((ok) => server.close(ok));
      }
    },
  );
}
