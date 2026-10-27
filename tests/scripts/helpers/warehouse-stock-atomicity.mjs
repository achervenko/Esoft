import assert from "node:assert/strict";

export async function verifyStockAtomicity(context, t) {
  const {
    prisma,
    WarehouseStockService,
    WarehouseStockQueryService,
    actor,
    audit,
    stock,
    a,
    b,
    c,
    id,
    loc,
    transaction,
    receive,
    issue,
    read,
    newItem,
  } = context;
  await t.test(
    "audit and movement roll back together, including a failure after the first leg",
    async () => {
      await receive(a, "1");
      await issue(a, "1");
      await receive(b, "13");
      await receive(c, "12");
      const before = await stock.getBalances({
        warehouseId: String(a.warehouseId),
        itemId: id,
        quantityState: "ALL",
      });
      const count = await prisma.auditLog.count({
        where: { entityType: "warehouse_balance", userId: actor.id },
      });
      let calls = 0;
      const failing = new WarehouseStockService(
        new WarehouseStockQueryService(prisma),
        {
          async writeFieldChanges(params) {
            if (++calls === 2)
              throw new Error("Injected second-leg audit failure");
            await audit.writeFieldChanges(params);
          },
        },
      );
      await assert.rejects(
        transaction((ctx) => failing.moveStock(ctx, id, loc(b), loc(a), "1")),
        /second-leg audit failure/,
      );
      assert.deepEqual(
        await stock.getBalances({
          warehouseId: String(a.warehouseId),
          itemId: id,
          quantityState: "ALL",
        }),
        before,
      );
      assert.equal(
        await prisma.auditLog.count({
          where: { entityType: "warehouse_balance", userId: actor.id },
        }),
        count,
      );
      const fresh = await newItem("STOCK-AUDIT-ROLLBACK");
      const failingCreate = new WarehouseStockService(
        new WarehouseStockQueryService(prisma),
        {
          async writeFieldChanges() {
            throw new Error("Injected receipt audit failure");
          },
        },
      );
      await assert.rejects(
        transaction((ctx) =>
          failingCreate.receiveStock(ctx, fresh, loc(a), "1"),
        ),
        /receipt audit failure/,
      );
      assert.equal(await read(a, fresh), null);
      await assert.rejects(
        transaction(async (ctx) => {
          await stock.receiveStock(ctx, id, loc(a), "7");
          assert.equal(
            (await stock.getBalance(id, loc(a), ctx.tx)).quantity,
            "7",
          );
          assert.equal(await stock.getItemTotal(id, undefined, ctx.tx), "32");
          assert.equal(
            (
              await stock.getBalances(
                { warehouseId: String(a.warehouseId), itemId: id },
                ctx.tx,
              )
            ).total,
            3,
          );
          throw new Error("Document failure");
        }),
        /Document failure/,
      );
      assert.deepEqual(
        await stock.getBalances({
          warehouseId: String(a.warehouseId),
          itemId: id,
          quantityState: "ALL",
        }),
        before,
      );
      const entries = await prisma.auditLog.findMany({
        where: { entityType: "warehouse_balance", userId: actor.id },
      });
      assert.ok(entries.length > 0);
      assert.ok(
        entries.every(
          (row) =>
            row.entityId === null &&
            row.entityStringId &&
            row.module === "WAREHOUSE" &&
            row.userId === actor.id,
        ),
      );
    },
  );
}
