import assert from "node:assert/strict";

export async function verifyStockQuantitySnapshots(
  c,
  t,
  {
    fixture,
    manager,
    WarehouseStockQueryService,
    WarehouseStockOverviewService,
  },
) {
  await t.test(
    "reads use one snapshot while reservation and physical mutations commit between queries",
    async () => {
      for (const operation of [
        "reserve",
        "decrease",
        "move",
        "reduce",
        "restore",
        "consume",
        "receive",
        "issue",
        "stockMove",
      ]) {
        for (const method of [
          "balance",
          "list",
          "summary",
          "overview",
          "distribution",
        ]) {
          const f = await fixture();
          if (operation === "restore")
            await c.transaction((ctx) =>
              manager.reduceCoverage(ctx, f.command(c.a, "1")),
            );
          const writes = {
            reserve: () => f.reserve(c.a, "1"),
            decrease: () =>
              c.transaction((ctx) =>
                manager.decrease(ctx, {
                  reservationId: f.reservation.id,
                  allocations: [{ locationId: c.loc(c.a), quantity: "1" }],
                  deficitQuantity: "0",
                }),
              ),
            move: () =>
              c.transaction((ctx) =>
                manager.move(ctx, {
                  reservationId: f.reservation.id,
                  fromLocationId: c.loc(c.a),
                  toLocationId: c.loc(c.b),
                  quantity: "1",
                }),
              ),
            reduce: () =>
              c.transaction((ctx) =>
                manager.reduceCoverage(ctx, f.command(c.a, "1")),
              ),
            restore: () =>
              c.transaction((ctx) =>
                manager.restoreCoverage(ctx, f.command(c.a, "1")),
              ),
            consume: () =>
              c.transaction((ctx) => manager.consume(ctx, f.command(c.a, "1"))),
            receive: () => c.receive(c.a, "1", f.itemId),
            issue: () => c.issue(c.a, "1", f.itemId),
            stockMove: () => c.move(c.a, c.b, "1", f.itemId),
          };
          const originalQuery = new WarehouseStockQueryService(c.prisma);
          const originalOverview = new WarehouseStockOverviewService(c.prisma);
          const queryArgs = { itemId: f.itemId, quantityState: "ALL" };
          const article = (
            await c.prisma.warehouseItem.findUniqueOrThrow({
              where: { id: BigInt(f.itemId) },
            })
          ).article;
          const read = (queries, overview) => {
            switch (method) {
              case "balance":
                return queries.getBalance(f.itemId, c.loc(c.a));
              case "list":
                return queries.getBalances(queryArgs);
              case "summary":
                return queries.getItemSummary(f.itemId);
              case "overview":
                return overview.list({ search: article, quantityState: "ALL" });
              default:
                return overview.distribution(f.itemId, String(c.a.warehouseId));
            }
          };
          const before = await read(originalQuery, originalOverview);
          let committed = false;
          const reader = c.prisma.$extends({
            query: {
              async $allOperations({ args, query }) {
                const result = await query(args);
                if (!committed) {
                  committed = true;
                  await writes[operation]();
                }
                return result;
              },
            },
          });
          const result = await read(
            new WarehouseStockQueryService(reader),
            new WarehouseStockOverviewService(reader),
          );
          assert.equal(committed, true, operation + "/" + method);
          assert.deepEqual(result, before, operation + "/" + method);
        }
      }
    },
  );

  await t.test(
    "reservation query count is bounded by the page, not by the number of balances",
    async () => {
      const f = await fixture();
      const operations = [];
      const reader = c.prisma.$extends({
        query: {
          async $allOperations({ operation, args, query }) {
            operations.push(operation);
            return query(args);
          },
        },
      });
      const queries = new WarehouseStockQueryService(reader);
      await queries.getBalances({
        itemId: f.itemId,
        quantityState: "ALL",
        limit: 1,
      });
      const first = operations.length;
      operations.length = 0;
      await queries.getBalances({
        itemId: f.itemId,
        quantityState: "ALL",
        limit: 100,
      });
      assert.equal(operations.length, first);
      assert.equal(first, 3);
    },
  );
}
