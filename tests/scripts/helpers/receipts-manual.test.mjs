import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-receipts-test-context.mjs";
export async function receiptsManual(c, t) {
  const { receipts, prisma, keeper, quantity, place } = c;
  await t.test(
    "all mixed item and draft line permutations replay the same manual receipt",
    async () => {
      const ids = ["2000000000000000", "10000000000000000"];
      for (const id of ids)
        await prisma.warehouseItem.create({
          data: {
            id: BigInt(id),
            article: c.namespace + id,
            name: "Sort test",
            unit: "шт",
          },
        });
      const draftId = "15000000-0000-4000-8000-000000000000";
      const payload = {
        warehouseId: String(c.warehouse.id),
        requestKey: randomUUID(),
        newItems: [
          {
            draftId,
            item: {
              article: c.namespace + "sort-draft",
              name: "Draft",
              unit: "шт",
            },
          },
        ],
        lines: [
          { itemId: ids[0], quantity: "1" },
          { itemId: ids[1], quantity: "1" },
          { draftId, quantity: "2" },
          { draftId, quantity: "1" },
        ],
      };
      function permutations(rows) {
        return rows.length === 0
          ? [[]]
          : rows.flatMap((row, i) =>
              permutations(rows.filter((_, j) => j !== i)).map((rest) => [
                row,
                ...rest,
              ]),
            );
      }
      const original = await receipts.createManual(payload, keeper.id);
      for (const lines of permutations(payload.lines)) {
        const replay = await receipts.createManual(
          { ...payload, lines },
          keeper.id,
        );
        assert.equal(replay.id, original.id);
      }
      assert.equal(
        await prisma.warehouseItem.count({
          where: { article: c.namespace + "sort-draft" },
        }),
        1,
      );
    },
  );
  await t.test(
    "manual receipt creates shared draft items atomically and replays without duplicates",
    async () => {
      const draftId = randomUUID();
      const article = c.namespace + "-draft";
      const payload = {
        warehouseId: String(c.warehouse.id),
        requestKey: randomUUID(),
        newItems: [
          { draftId, item: { article, name: "Новый товар", unit: "шт" } },
        ],
        lines: [
          { draftId, quantity: "2" },
          { draftId, quantity: "3" },
          { itemId: String(c.item.id), quantity: "1" },
        ],
      };
      const before = await quantity();
      const originalAudit = c.audit.writeFieldChanges;
      c.audit.writeFieldChanges = async (params) => {
        if (params.entityType === "warehouse_receipt")
          throw Error("receipt audit failed");
        return originalAudit(params);
      };
      try {
        await assert.rejects(
          receipts.createManual(payload, keeper.id),
          /receipt audit failed/,
        );
      } finally {
        c.audit.writeFieldChanges = originalAudit;
      }
      assert.equal(await prisma.warehouseItem.count({ where: { article } }), 0);
      assert.equal(
        await prisma.warehouseReceipt.count({
          where: {
            sourceOperationId: JSON.stringify([keeper.id, payload.requestKey]),
          },
        }),
        0,
      );
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          receipts.createManual(payload, keeper.id),
        ),
      );
      assert.ok(results.every((r) => r.id === results[0].id));
      assert.equal(await prisma.warehouseItem.count({ where: { article } }), 1);
      assert.equal(results[0].lines[0].itemId, results[0].lines[1].itemId);
      assert.equal(await quantity(), before);
      await assert.rejects(
        receipts.createManual(
          {
            ...payload,
            newItems: [
              {
                ...payload.newItems[0],
                item: { ...payload.newItems[0].item, name: "changed" },
              },
            ],
          },
          keeper.id,
        ),
        code("WAREHOUSE_RECEIPT_REQUEST_CONFLICT"),
      );
      const freshId = randomUUID(),
        collisionId = randomUUID();
      const freshArticle = article + "-rolled-back";
      await assert.rejects(
        receipts.createManual(
          {
            ...payload,
            requestKey: randomUUID(),
            newItems: [
              {
                draftId: freshId,
                item: { article: freshArticle, name: "Fresh", unit: "шт" },
              },
              {
                draftId: collisionId,
                item: { article, name: "Duplicate", unit: "шт" },
              },
            ],
            lines: [
              { draftId: freshId, quantity: "1" },
              { draftId: collisionId, quantity: "1" },
            ],
          },
          keeper.id,
        ),
        code("WAREHOUSE_ARTICLE_EXISTS"),
      );
      assert.equal(
        await prisma.warehouseItem.count({ where: { article: freshArticle } }),
        0,
      );
    },
  );
  await t.test(
    "manual request identity, current permissions and rollback",
    async () => {
      const payload = {
        warehouseId: String(c.warehouse.id),
        requestKey: randomUUID(),
        lines: [{ itemId: String(c.item.id), quantity: "1" }],
      };
      const a = await receipts.createManual(payload, keeper.id),
        b = await receipts.createManual(payload, keeper.id);
      assert.equal(a.id, b.id);
      await assert.rejects(
        receipts.createManual({ ...payload, comment: "changed" }, keeper.id),
        code("WAREHOUSE_RECEIPT_REQUEST_CONFLICT"),
      );
      await prisma.user.update({
        where: { id: keeper.id },
        data: { banned: true },
      });
      await assert.rejects(
        receipts.createManual(payload, keeper.id),
        code("FORBIDDEN"),
      );
      await prisma.user.update({
        where: { id: keeper.id },
        data: { banned: false },
      });
      const before = await quantity();
      c.failAudit(true);
      try {
        await assert.rejects(place(a, "1"), /audit failed/);
      } finally {
        c.failAudit(false);
      }
      assert.equal(await quantity(), before);
      assert.equal(
        (await receipts.findOne(a.id)).lines[0].placements.length,
        0,
      );
    },
  );
}
