import assert from "node:assert/strict";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyStockConcurrency(context, t) {
  const { prisma, actor, a, b, receive, issue, move, read, newItem } = context;
  await t.test(
    "parallel first receipts create one row and lose no increments",
    async () => {
      const racing = await newItem("STOCK-RACE");
      const results = await Promise.all(
        Array.from({ length: 8 }, () => receive(a, "0.125", racing)),
      );
      assert.equal(new Set(results.map((row) => row.id)).size, 1);
      assert.equal((await read(a, racing)).quantity, "1");
      assert.equal(
        await prisma.warehouseBalance.count({
          where: { itemId: BigInt(racing) },
        }),
        1,
      );
      const entry = await read(a, racing);
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType: "warehouse_balance",
          userId: actor.id,
          entityStringId: entry.id,
        },
      });
      assert.equal(logs.length, 8);
    },
  );

  await t.test(
    "parallel issues cannot overspend and opposite moves complete without deadlock",
    async () => {
      const racing = await newItem("STOCK-SPEND");
      await receive(a, "5", racing);
      const attempts = await Promise.allSettled([
        issue(a, "4", racing),
        issue(a, "4", racing),
      ]);
      assert.equal(
        attempts.filter((entry) => entry.status === "fulfilled").length,
        1,
      );
      hasCode(
        "WAREHOUSE_STOCK_INSUFFICIENT",
        409,
      )(attempts.find((entry) => entry.status === "rejected").reason);
      assert.equal((await read(a, racing)).quantity, "1");
      await receive(a, "9", racing);
      await receive(b, "10", racing);
      await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          i % 2 ? move(a, b, "1", racing) : move(b, a, "1", racing),
        ),
      );
      assert.equal((await read(a, racing)).quantity, "10");
      assert.equal((await read(b, racing)).quantity, "10");
    },
  );
}
