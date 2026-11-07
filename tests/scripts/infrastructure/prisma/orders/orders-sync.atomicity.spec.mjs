import assert from "node:assert/strict";
import { rawOrder, OrdersSyncService } from "./orders-sync.test-context.mjs";
export async function verifyAtomicity(context, t) {
  const { c, first, source, sync, service, refresh, find, state } = context;
  await t.test(
    "a malformed later page leaves all previous orders and history intact",
    async () => {
      const before = await find();
      state.rows = [{ ...first, Number: "must roll back" }];
      state.broken = true;
      await assert.rejects(
        refresh(),
        (e) => e.code === "ORDERS_RESPONSE_INVALID",
      );
      state.broken = false;
      assert.equal((await find()).number, before.number);
      assert.equal(
        await c.prisma.customerOrderChange.count({
          where: { orderId: before.id },
        }),
        4,
      );
      const sources = await service.sources();
      assert.equal(sources[0].lastErrorCode, "ORDERS_RESPONSE_INVALID");
      assert.equal(sources[0].runs[0].outcome, "FAILED");
      assert.ok(!JSON.stringify(sources).includes("Bearer secret"));
      assert.ok(!JSON.stringify(sources).includes("authorizationEncrypted"));
    },
  );
  await t.test(
    "missing Ref_Key on the second page preserves orders and history",
    async () => {
      const snapshot = async () => ({
        orders: await c.prisma.customerOrder.findMany({
          orderBy: { id: "asc" },
        }),
        history: await c.prisma.customerOrderChange.findMany({
          orderBy: { id: "asc" },
        }),
      });
      const before = await snapshot();
      const previousRows = state.rows;
      try {
        state.rows = [
          { ...first, Number: "must not persist" },
          ...Array.from({ length: 199 }, () => rawOrder()),
          { ...rawOrder(), Ref_Key: undefined },
        ];
        await assert.rejects(refresh(), { code: "ORDERS_RESPONSE_INVALID" });
        assert.deepEqual(await snapshot(), before);
      } finally {
        state.rows = previousRows;
      }
    },
  );
  await t.test(
    "failure after updating the row rolls back both data and history",
    async () => {
      const before = await find();
      const proxy = new Proxy(c.prisma, {
        get(target, prop) {
          if (prop === "$transaction")
            return (fn, options) =>
              target.$transaction(
                (tx) =>
                  fn(
                    new Proxy(tx, {
                      get(inner, key) {
                        if (key === "customerOrderChange")
                          return new Proxy(inner.customerOrderChange, {
                            get(delegate, field) {
                              if (field === "create")
                                return async () => {
                                  throw Error("history write failed");
                                };
                              return Reflect.get(delegate, field);
                            },
                          });
                        return Reflect.get(inner, key);
                      },
                    }),
                  ),
                options,
              );
          return Reflect.get(target, prop);
        },
      });
      await assert.rejects(
        () =>
          new OrdersSyncService(proxy, c.registry).sync(source.id, c.admin.id),
        /history write failed/,
      );
      assert.equal((await find()).number, before.number);
      assert.equal(
        await c.prisma.customerOrderChange.count({
          where: { orderId: before.id },
        }),
        4,
      );
    },
  );
  await t.test(
    "manual and automatic requests cannot apply competing snapshots",
    async () => {
      let release;
      state.gate = new Promise((resolve) => {
        release = resolve;
      });
      const reached = new Promise((resolve) => {
        state.entered = resolve;
      });
      const running = refresh();
      await reached;
      try {
        assert.equal((await refresh()).outcome, "BUSY");
        await assert.rejects(
          () =>
            c.prisma.$transaction(async (tx) => {
              await tx.$queryRaw`SELECT id FROM integration_sources WHERE id=${source.id}::uuid FOR UPDATE NOWAIT`;
            }),
          /55P03/,
        );
      } finally {
        state.gate = null;
        release();
      }
      assert.equal((await running).outcome, "SUCCESS");
    },
  );
}
