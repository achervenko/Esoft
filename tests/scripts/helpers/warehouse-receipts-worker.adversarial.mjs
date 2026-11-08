import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Prisma } = require("@prisma/client");

export async function adversarialReceiptWorker(c, t) {
  let sourceSystem = c.sourceSystem + "-worker";
  let document = c.source(),
    fetched = 0;
  const server = createServer((_req, res) => {
    fetched++;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(document));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
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
      authorization: "Bearer worker-only",
    },
    c.admin.id,
  );
  sourceSystem = configuredSource.code;
  const sourceId = configuredSource.id;
  await c.integrationWarehouses.save(
    sourceSystem,
    {
      externalId: c.source().warehouse.id,
      warehouseId: String(c.warehouse.id),
    },
    c.admin.id,
  );
  const key = await c.coreKeys.create(
    sourceSystem,
    { flows: { "warehouse.receipts": ["event:create"] }, name: "Worker key" },
    c.admin.id,
  );
  const enqueue = async () => {
    const accepted = await c.coreEvents.accept(
      sourceSystem,
      "warehouse.receipts",
      { objectId: document.id },
      `Bearer ${key.key}`,
    );
    return c.prisma.integrationEvent.findUniqueOrThrow({
      where: { id: BigInt(accepted.id) },
    });
  };
  try {
    await t.test(
      "failed import audit cannot acknowledge the event; a restarted worker recovers it",
      async () => {
        const event = await enqueue(),
          beforeAudit = await c.prisma.auditLog.count();
        const originalAudit = c.audit.writeFieldChanges;
        c.audit.writeFieldChanges = (params) =>
          c.realAudit.writeFieldChanges({ ...params, userId: randomUUID() });
        try {
          await c.coreWorker.process(event.id);
        } finally {
          c.audit.writeFieldChanges = originalAudit;
        }
        const failed = await c.prisma.integrationEvent.findUniqueOrThrow({
          where: { id: event.id },
        });
        assert.equal(failed.status, "PENDING");
        assert.equal(failed.attempts, 1);
        assert.equal(
          await c.prisma.warehouseReceipt.count({ where: { sourceSystem } }),
          0,
        );
        assert.equal(await c.prisma.auditLog.count(), beforeAudit);
        const {
          IntegrationWorkerService,
        } = require("../../../backend/dist/src/integrations/integration-worker.service.js");
        const restarted = new IntegrationWorkerService(c.prisma, c.registry);
        await c.prisma.integrationEvent.update({
          where: { id: event.id },
          data: { nextAttemptAt: new Date(0) },
        });
        await restarted.process(event.id);
        assert.equal(
          (
            await c.prisma.integrationEvent.findUniqueOrThrow({
              where: { id: event.id },
            })
          ).status,
          "PROCESSED",
        );
        assert.equal(
          await c.prisma.warehouseReceipt.count({ where: { sourceSystem } }),
          1,
        );
        c.trace("assertion", {
          name: "audit rollback retains durable inbox, new worker recovers without lost or duplicated document",
        });
      },
    );
    await t.test(
      "parallel object notifications fetch each delivery but apply identical content once",
      async () => {
        document = c.source({ version: "2" });
        const before = fetched;
        const events = [await enqueue(), await enqueue()];
        await Promise.all(
          events.map((event) => c.coreWorker.process(event.id)),
        );
        for (const event of events) await c.coreWorker.process(event.id);
        assert.equal(fetched - before, 2);
        assert.equal(
          (
            await c.prisma.warehouseReceipt.findFirstOrThrow({
              where: { sourceSystem, sourceOperationId: document.id },
            })
          ).sourceVersion,
          1n,
        );
        for (const event of events)
          assert.equal(
            (
              await c.prisma.integrationEvent.findUniqueOrThrow({
                where: { id: event.id },
              })
            ).status,
            "PROCESSED",
          );
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise((ok) => server.close(ok));
  }

  await t.test(
    "20 concurrent manual retries and 20 concurrent placement retries create one operation",
    async () => {
      const payload = {
        warehouseId: String(c.warehouse.id),
        requestKey: randomUUID(),
        lines: [{ itemId: String(c.item.id), quantity: "10" }],
      };
      const before = await c.quantity();
      const receipts = await Promise.all(
        Array.from({ length: 20 }, () =>
          c.receipts.createManual(payload, c.keeper.id),
        ),
      );
      assert.equal(new Set(receipts.map((receipt) => receipt.id)).size, 1);
      assert.equal(await c.quantity(), before);
      const receipt = receipts[0],
        placement = c.placement("1");
      const placed = await Promise.all(
        Array.from({ length: 20 }, () =>
          c.placements.place(
            receipt.id,
            receipt.lines[0].id,
            placement,
            c.keeper.id,
          ),
        ),
      );
      assert.equal(new Set(placed.map((row) => row.id)).size, 1);
      assert.equal(
        new Prisma.Decimal(await c.quantity()).minus(before).toString(),
        "1",
      );
    },
  );
  await t.test(
    "20 independent placements cannot overreceive a 10-unit document",
    async () => {
      const receipt = await c.manual("10"),
        before = await c.quantity();
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => c.place(receipt, "1")),
      );
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        10,
      );
      for (const result of results)
        if (result.status === "rejected")
          assert.equal(
            result.reason.response?.code,
            "WAREHOUSE_RECEIPT_OVERPLACEMENT",
          );
      assert.equal(
        new Prisma.Decimal(await c.quantity()).minus(before).toString(),
        "10",
      );
      assert.equal((await c.receipts.findOne(receipt.id)).status, "PLACED");
    },
  );
  await t.test(
    "a fully placed manual receipt cannot be reconciled into two source documents concurrently",
    async () => {
      const manual = await c.manual("5");
      await c.place(manual, "5");
      const before = await c.quantity();
      const targets = [
        await c.mapped(
          c.source({ lines: [{ ...c.source().lines[0], quantity: "5" }] }),
        ),
        await c.mapped(
          c.source({ lines: [{ ...c.source().lines[0], quantity: "5" }] }),
        ),
      ];
      const results = await Promise.allSettled(
        targets.map((target) =>
          c.reconciliation.reconcile(
            target.id,
            {
              manualReceiptId: manual.id,
              lines: [
                {
                  manualLineId: manual.lines[0].id,
                  receiptLineId: target.lines[0].id,
                },
              ],
            },
            c.keeper.id,
          ),
        ),
      );
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      for (const result of results)
        if (result.status === "rejected")
          assert.equal(
            result.reason.response?.code,
            "WAREHOUSE_RECEIPT_ALREADY_RECONCILED",
          );
      assert.equal(await c.quantity(), before);
    },
  );
  await t.test(
    "two concurrent mappings of one external identity select exactly one canonical item",
    async () => {
      const externalId = c.namespace + "-mapping-race";
      const input = () => {
        const doc = c.source();
        doc.lines[0].item.id = externalId;
        return doc;
      };
      const receipts = [await c.ingest(input()), await c.ingest(input())];
      const other = await c.prisma.warehouseItem.create({
        data: {
          article: c.namespace + "-other-canonical",
          name: "Other canonical candidate",
          unit: "шт",
        },
      });
      const results = await Promise.allSettled(
        [c.item, other].map((item, index) =>
          c.itemMapping.mapItem(
            receipts[index].id,
            receipts[index].lines[0].id,
            { itemId: String(item.id) },
            c.keeper.id,
          ),
        ),
      );
      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      for (const result of results)
        if (result.status === "rejected")
          assert.equal(
            result.reason.response?.code,
            "WAREHOUSE_RECEIPT_MAPPING_CONFLICT",
          );
      const link = await c.prisma.warehouseItemExternalLink.findUniqueOrThrow({
        where: {
          sourceSystem_externalId: { sourceSystem: c.sourceSystem, externalId },
        },
      });
      const rows = await c.prisma.warehouseReceiptLine.findMany({
        where: { externalItemId: externalId },
      });
      assert.equal(rows.length, 2);
      assert.ok(rows.every((row) => row.itemId === link.itemId));
    },
  );
}
