import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  applyOrders,
} = require("../../../../../backend/dist/src/orders/orders-import.js");
export async function verifyBatching({ c, source }, t) {
  await t.test(
    "unchanged order batches preserve history, isolation, missing recovery and rollback",
    async () => {
      const other = await c.sources.create(
        {
          name: "Batch source",
          systemType: "ONE_C",
          baseUrl: "http://127.0.0.1:1/",
          authorization: "Bearer test",
        },
        c.admin.id,
      );
      const initial = new Date("2026-01-01T00:00:00Z"),
        observed = new Date("2026-11-08T00:00:00Z");
      const rows = Array.from({ length: 1001 }, (_, i) => ({
        externalId: randomUUID(),
        number: "batch-" + i,
        name: "",
        documentDate: "2026-01-01T00:00:00",
        status: "КОбеспечению",
        posted: true,
        deletionMark: false,
      }));
      await c.prisma.customerOrder.createMany({
        data: rows.map((r) => ({
          ...r,
          id: randomUUID(),
          sourceId: other.id,
          checkedAt: initial,
          changedAt: initial,
        })),
      });
      const stored = await c.prisma.customerOrder.findMany({
        where: { sourceId: other.id },
        orderBy: { number: "asc" },
      });
      await c.prisma.customerOrder.update({
        where: { id: stored[0].id },
        data: { missingChecks: 1 },
      });
      const foreign = await c.prisma.customerOrder.create({
        data: {
          ...rows[0],
          id: randomUUID(),
          sourceId: source.id,
          checkedAt: initial,
          changedAt: initial,
        },
      });
      const calls = [];
      const run = (time, fail = false) =>
        c.prisma.$transaction(
          async (tx) =>
            applyOrders(
              new Proxy(tx, {
                get(target, key) {
                  if (key !== "customerOrder") return Reflect.get(target, key);
                  return new Proxy(target.customerOrder, {
                    get(delegate, method) {
                      const value = Reflect.get(delegate, method);
                      if (typeof value !== "function") return value;
                      return async (...args) => {
                        calls.push(method);
                        const result = await value.apply(delegate, args);
                        if (fail && method === "updateMany")
                          throw Error("batch write failed");
                        return result;
                      };
                    },
                  });
                },
              }),
              other.id,
              rows,
              time,
            ),
          { timeout: 20000 },
        );
      assert.deepEqual(await run(observed), { received: 1001, changed: 0 });
      assert.equal(calls.filter((m) => m === "updateMany").length, 2);
      assert.equal(
        calls.filter((m) => m === "findUnique" || m === "update").length,
        0,
      );
      assert.equal(
        await c.prisma.customerOrderChange.count({
          where: { order: { sourceId: other.id } },
        }),
        0,
      );
      const after = await c.prisma.customerOrder.findMany({
        where: { sourceId: other.id },
        orderBy: { number: "asc" },
      });
      assert.ok(
        after.every(
          (r) =>
            r.checkedAt.getTime() === observed.getTime() &&
            r.changedAt.getTime() === initial.getTime() &&
            r.missingChecks === 0,
        ),
      );
      assert.deepEqual(
        await c.prisma.customerOrder.findUnique({ where: { id: foreign.id } }),
        foreign,
      );
      await assert.rejects(
        run(new Date("2026-11-09"), true),
        /batch write failed/,
      );
      assert.deepEqual(
        await c.prisma.customerOrder.findMany({
          where: { sourceId: other.id },
          orderBy: { number: "asc" },
        }),
        after,
      );
      // A duplicate identity in the same snapshot still rejects and rolls back every change.
      await assert.rejects(
        c.prisma.$transaction((tx) =>
          applyOrders(tx, other.id, [rows[0], rows[0]], observed),
        ),
        { code: "ORDERS_IDENTITY_AMBIGUOUS" },
      );
      await c.prisma.customerOrder.update({
        where: { id: stored[0].id },
        data: { missingChecks: 2 },
      });
      assert.equal((await run(observed)).changed, 1);
      assert.equal(
        await c.prisma.customerOrderChange.count({
          where: { orderId: stored[0].id },
        }),
        1,
      );
      rows[0] = {
        ...rows[0],
        externalId: rows[0].externalId.toUpperCase(),
        posted: false,
      };
      assert.equal((await run(observed)).changed, 1);
      assert.equal(
        await c.prisma.customerOrder.count({ where: { sourceId: other.id } }),
        1001,
      );
      const fallback = {
        ...rows[1],
        externalId: null,
        number: "fallback-only",
      };
      const fallbackId = randomUUID();
      await c.prisma.customerOrder.create({
        data: {
          ...fallback,
          id: fallbackId,
          sourceId: other.id,
          checkedAt: initial,
          changedAt: initial,
        },
      });
      rows[0] = { ...rows[0], externalId: rows[0].externalId.toLowerCase() };
      rows.push(fallback);
      assert.equal((await run(observed)).changed, 0);
      assert.equal(
        (
          await c.prisma.customerOrder.findUniqueOrThrow({
            where: { id: fallbackId },
          })
        ).checkedAt.getTime(),
        observed.getTime(),
      );
    },
  );
}
