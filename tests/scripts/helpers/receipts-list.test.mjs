import assert from "node:assert/strict";
export async function receiptsList(c, t) {
  const { prisma, manual } = c;
  await t.test(
    "receipt sorting is stable across server pages and defaults to newest first",
    async () => {
      const all = {
        warehouseId: String(c.warehouse.id),
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        limit: "100",
      };
      const asc = await c.queries.list({
        ...all,
        sortBy: "createdAt",
        sortOrder: "asc",
      });
      const desc = await c.queries.list(all);
      assert.deepEqual(
        desc.items.map((r) => r.id),
        asc.items.map((r) => r.id).reverse(),
      );
      const first = await c.queries.list({
        ...all,
        limit: "1",
        sortBy: "documentNumber",
        sortOrder: "asc",
      });
      const second = await c.queries.list({
        ...all,
        limit: "1",
        page: "2",
        sortBy: "documentNumber",
        sortOrder: "asc",
      });
      const sorted = await c.queries.list({
        ...all,
        sortBy: "documentNumber",
        sortOrder: "asc",
      });
      assert.equal(first.items[0].id, sorted.items[0].id);
      assert.equal(second.items[0].id, sorted.items[1].id);
      const updated = await manual("1");
      const earlier = new Date("2020-01-01T00:00:00Z");
      const receivedAt = new Date("2090-01-01T00:00:00Z");
      await prisma.warehouseReceipt.update({
        where: { id: BigInt(updated.id) },
        data: { createdAt: earlier, receivedAt },
      });
      const received = await c.queries.list({ ...all, sortBy: "receivedAt" });
      assert.equal(received.items[0].id, updated.id);
      assert.equal(received.items[0].receivedAt, receivedAt.toISOString());
      const created = await c.queries.list({ ...all, sortBy: "createdAt" });
      assert.notEqual(created.items[0].id, updated.id);
    },
  );
}
