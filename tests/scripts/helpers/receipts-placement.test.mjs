import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-receipts-test-context.mjs";
export async function receiptsPlacement(c, t) {
  const { receipts, prisma, keeper, manual, place, quantity } = c;
  await t.test(
    "manual document never changes stock; partial/full placement and replay",
    async () => {
      const before = await quantity(),
        r = await manual("10.001");
      assert.equal(r.status, "RECEIVED");
      assert.equal(await quantity(), before);
      const key = randomUUID(),
        p = await place(r, "4", c.location.id, key);
      assert.equal((await place(r, "4", c.location.id, key)).id, p.id);
      let current = await receipts.findOne(r.id);
      assert.equal(current.status, "PLACING");
      assert.equal(current.lines[0].remaining, "6.001");
      assert.equal(current.totalQuantity, "10.001");
      assert.equal(current.placedQuantity, "4");
      const summary = (
        await c.queries.list({ warehouseId: String(c.warehouse.id) })
      ).items.find((row) => row.id === r.id);
      assert.equal(summary.totalQuantity, "10.001");
      assert.equal(summary.placedQuantity, "4");
      assert.equal(summary.placedLineCount, 0);

      await assert.rejects(
        place(r, "7"),
        code("WAREHOUSE_RECEIPT_OVERPLACEMENT"),
      );
      await assert.rejects(
        place(r, "3", c.location.id, key),
        code("WAREHOUSE_RECEIPT_REQUEST_CONFLICT"),
      );
      await place(r, "6.001", c.target.id);
      current = await receipts.findOne(r.id);
      assert.equal(current.status, "PLACED");
      assert.equal(current.lines[0].placed, "10.001");
      assert.ok(current.placedAt);
      await prisma.warehouseItem.update({
        where: { id: c.item.id },
        data: { name: "Renamed" },
      });
      const history = await receipts.findOne(r.id);
      assert.equal(history.lines[0].placements[0].item.name, "Bearing");
    },
  );
  await t.test(
    "concurrent independent placements cannot exceed receipt quantity",
    async () => {
      const r = await manual("5");
      const race = await Promise.allSettled([
        place(r, "4"),
        place(r, "4", c.target.id),
      ]);
      assert.equal(race.filter((x) => x.status === "fulfilled").length, 1);
      const rejected = race.find((x) => x.status === "rejected");
      assert.equal(
        rejected.reason.response.code,
        "WAREHOUSE_RECEIPT_OVERPLACEMENT",
      );
      assert.equal((await receipts.findOne(r.id)).lines[0].placed, "4");
      const r2 = await manual("2"),
        key = randomUUID();
      const same = await Promise.all([
        place(r2, "2", c.location.id, key),
        place(r2, "2", c.location.id, key),
      ]);
      assert.equal(same[0].id, same[1].id);
    },
  );
  await t.test(
    "warehouse/activity validation does not create movements",
    async () => {
      const r = await manual("2"),
        before = await quantity();
      await assert.rejects(
        place(r, "1", c.other.id),
        code("WAREHOUSE_RECEIPT_LOCATION_MISMATCH"),
      );
      await prisma.warehouseStorageLocation.update({
        where: { id: c.target.id },
        data: { isActive: false },
      });
      await assert.rejects(
        place(r, "1", c.target.id),
        code("WAREHOUSE_RECEIPT_INACTIVE_REFERENCE"),
      );
      await prisma.warehouseStorageLocation.update({
        where: { id: c.target.id },
        data: { isActive: true },
      });
      assert.equal(await quantity(), before);
    },
  );
  await t.test(
    "manual cancellation is allowed only before physical placement",
    async () => {
      const empty = await manual("2");
      await receipts.cancelManual(empty.id, keeper.id);
      assert.equal((await receipts.findOne(empty.id)).status, "CANCELLED");
      const started = await manual("2");
      await place(started, "1");
      await assert.rejects(
        receipts.cancelManual(started.id, keeper.id),
        code("WAREHOUSE_RECEIPT_ALREADY_PLACED"),
      );
    },
  );
}
