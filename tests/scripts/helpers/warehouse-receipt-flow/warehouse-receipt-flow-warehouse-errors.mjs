import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function verifyWarehouseErrors(context, { receipt }, t) {
  const {
    prisma,
    warehouse,
    warehouseLinks,
    source,
    events,
    worker,
    admin,
    key,
  } = context;
  for (const [mode, notificationIndex] of [
    ["UNMAPPED", "1"],
    ["UNMAPPED", "2"],
    ["INACTIVE", "1"],
    ["INACTIVE", "2"],
  ]) {
    await t.test(
      `repeat notification ${notificationIndex} still checks warehouse: ${mode}`,
      async () => {
        const originalDocument = context.document;
        const before = await prisma.warehouseReceipt.findUniqueOrThrow({
          where: { id: receipt.id },
        });
        if (mode === "UNMAPPED")
          context.document = {
            ...context.document,
            warehouse: { id: randomUUID(), name: "Unknown" },
          };
        else
          await prisma.warehouse.update({
            where: { id: warehouse.warehouse.id },
            data: { isActive: false },
          });
        try {
          const replay = await events.accept(
            source.code,
            "warehouse.receipts",
            { objectId: context.document.id },
            `Bearer ${key.key}`,
          );
          await worker.process(BigInt(replay.id));
          const failed = await prisma.integrationEvent.findUniqueOrThrow({
            where: { id: BigInt(replay.id) },
          });
          assert.equal(failed.status, "FAILED");
          assert.equal(failed.lastErrorCode, `ONE_C_WAREHOUSE_${mode}`);
          assert.deepEqual(
            await prisma.warehouseReceipt.findUniqueOrThrow({
              where: { id: receipt.id },
            }),
            before,
          );
          assert.equal(await warehouse.quantity(), "10");
        } finally {
          context.document = originalDocument;
          await prisma.warehouse.update({
            where: { id: warehouse.warehouse.id },
            data: { isActive: true },
          });
        }
      },
    );
  }
  await t.test(
    "unknown warehouse skips the event without a receipt or automatic retries",
    async () => {
      context.document = warehouse.source({
        warehouse: { id: randomUUID(), name: "Unknown" },
      });
      const rejected = await events.accept(
        source.code,
        "warehouse.receipts",
        { objectId: context.document.id },
        `Bearer ${key.key}`,
      );
      await worker.process(BigInt(rejected.id));
      const failed = await prisma.integrationEvent.findUniqueOrThrow({
        where: { id: BigInt(rejected.id) },
      });
      assert.equal(failed.status, "SKIPPED");
      assert.equal(failed.resultCode, "ONE_C_WAREHOUSE_UNMAPPED");
      assert.equal(failed.lastErrorCode, null);
      assert.equal(failed.resultSummary.warehouseName, "Unknown");
      assert.equal(Object.hasOwn(failed.resultSummary, "lines"), false);
      await worker.process(BigInt(rejected.id));
      assert.equal(
        (
          await prisma.integrationEvent.findUniqueOrThrow({
            where: { id: BigInt(rejected.id) },
          })
        ).attempts,
        1,
      );
      assert.equal(
        await prisma.warehouseReceipt.count({
          where: {
            sourceSystem: source.code,
            sourceOperationId: context.document.id,
          },
        }),
        0,
      );
      assert.equal(await warehouse.quantity(), "10");
      await warehouseLinks.save(
        source.code,
        {
          externalId: context.document.warehouse.id,
          warehouseId: String(warehouse.warehouse.id),
        },
        admin.id,
      );
      await events.retry(BigInt(rejected.id), admin.id);
      await worker.process(BigInt(rejected.id));
      assert.equal(
        (
          await prisma.integrationEvent.findUniqueOrThrow({
            where: { id: BigInt(rejected.id) },
          })
        ).status,
        "PROCESSED",
      );
      assert.equal(
        (
          await prisma.warehouseReceipt.findFirstOrThrow({
            where: {
              sourceSystem: source.code,
              sourceOperationId: context.document.id,
            },
          })
        ).warehouseId,
        warehouse.warehouse.id,
      );
      assert.equal(await warehouse.quantity(), "10");
    },
  );

  await t.test("inactive mapped warehouse blocks new documents", async () => {
    const linkedId = context.document.warehouse.id;
    context.document = warehouse.source({
      warehouse: { id: linkedId, name: "Disabled warehouse" },
    });
    await prisma.warehouse.update({
      where: { id: warehouse.warehouse.id },
      data: { isActive: false },
    });
    try {
      const rejected = await events.accept(
        source.code,
        "warehouse.receipts",
        { objectId: context.document.id },
        `Bearer ${key.key}`,
      );
      await worker.process(BigInt(rejected.id));
      const failed = await prisma.integrationEvent.findUniqueOrThrow({
        where: { id: BigInt(rejected.id) },
      });
      assert.equal(failed.status, "SKIPPED");
      assert.equal(failed.resultCode, "ONE_C_WAREHOUSE_INACTIVE");
      assert.equal(
        await prisma.warehouseReceipt.count({
          where: {
            sourceSystem: source.code,
            sourceOperationId: context.document.id,
          },
        }),
        0,
      );
      await assert.rejects(
        warehouseLinks.save(
          source.code,
          {
            externalId: randomUUID(),
            warehouseId: String(warehouse.warehouse.id),
          },
          admin.id,
        ),
        (error) => error.getStatus() === 409,
      );
    } finally {
      await prisma.warehouse.update({
        where: { id: warehouse.warehouse.id },
        data: { isActive: true },
      });
    }
  });
}
