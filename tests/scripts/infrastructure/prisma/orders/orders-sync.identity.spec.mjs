import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rawOrder } from "./orders-sync.test-context.mjs";
export async function verifySourceIsolation(context, t) {
  const { c, first, source, server, sync } = context;
  await t.test(
    "same external identity from another source creates a different order",
    async () => {
      const other = await c.sources.create(
        {
          name: "Другая 1С",
          systemType: "ONE_C",
          baseUrl: `http://127.0.0.1:${server.address().port}/`,
          authorization: "Bearer secret",
          flows: [
            {
              flowCode: "orders.customers",
              configVersion: 1,
              config: {},
              isActive: true,
            },
          ],
        },
        c.admin.id,
      );
      await sync.sync(other.id, c.admin.id);
      assert.equal(
        await c.prisma.customerOrder.count({
          where: { externalId: first.Ref_Key },
        }),
        2,
      );
    },
  );
}
export async function verifySourceSwitch(context, t) {
  const { c, source, server, sync, state } = context;
  await t.test(
    "source switch preserves IDs and rolls back an invalid OData identity",
    async () => {
      const stored = await c.prisma.customerOrder.findMany({
        where: { sourceId: source.id },
      });
      const replacement = await c.sources.create(
        {
          name: "Новый источник заказов",
          systemType: "ONE_C",
          baseUrl: `http://127.0.0.1:${server.address().port}/`,
          authorization: "Bearer secret",
        },
        c.admin.id,
      );
      await c.sources.configureFlow(
        replacement.code,
        "orders.customers",
        {
          isActive: true,
          configVersion: 1,
          config: { previousSourceId: source.id },
        },
        c.admin.id,
      );
      const stable = rawOrder({
        Number: "SWITCH",
        Date: "2026-11-07T12:30:00",
      });
      await c.prisma.customerOrder.create({
        data: {
          id: randomUUID(),
          sourceId: source.id,
          externalId: stable.Ref_Key,
          number: stable.Number,
          name: "",
          documentDate: stable.Date,
          status: stable.Статус,
          posted: true,
          deletionMark: false,
          checkedAt: new Date(),
          changedAt: new Date(),
        },
      });
      const order = await c.prisma.customerOrder.findFirstOrThrow({
        where: { externalId: stable.Ref_Key },
      });
      state.rows = stored.map((row) =>
        rawOrder({
          Ref_Key: row.externalId,
          Number: row.number,
          Date: row.documentDate,
          IR_Проект: row.name,
          Статус: row.status,
          Posted: row.posted,
          DeletionMark: row.deletionMark,
        }),
      );
      const withoutKey = { ...stable, Ref_Key: undefined };
      const refreshReplacement = () => sync.sync(replacement.id, c.admin.id);
      const completeRows = [...state.rows, stable];
      state.rows = [...state.rows, withoutKey];
      await assert.rejects(refreshReplacement(), {
        code: "ORDERS_RESPONSE_INVALID",
      });
      assert.equal(
        (
          await c.prisma.customerOrder.findUniqueOrThrow({
            where: { id: order.id },
          })
        ).sourceId,
        source.id,
      );
      state.rows = completeRows;
      await refreshReplacement();
      const moved = await c.prisma.customerOrder.findUniqueOrThrow({
        where: { id: order.id },
      });
      assert.equal(moved.sourceId, replacement.id);
      assert.equal(moved.externalId, stable.Ref_Key);
      assert.equal((await refreshReplacement()).changed, 0);
    },
  );
}
