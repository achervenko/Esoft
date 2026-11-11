import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyReservationOrdersApi(
  c,
  t,
  { request, createOrder, manager },
) {
  await t.test(
    "reservation orders group positive positions, search literally, filter whole orders and retain totals on empty pages",
    async () => {
      const prefix = randomUUID();
      const first = await createOrder(prefix + "-same");
      const second = await createOrder(prefix + "-same");
      const zero = await createOrder(prefix + "-zero");
      await createOrder(prefix + "-empty");
      await c.prisma.customerOrder.update({
        where: { id: first.id },
        data: { name: "Имя заказа " + prefix, status: "Закрыт" },
      });
      const item = await c.newItem(prefix + "%_МАТЕРИАЛ");
      const extra = await c.newItem(prefix + "-extra");
      await c.receive(c.a, "30", item);
      await c.receive(c.a, "30", extra);
      const reserve = (orderId, itemId, quantity) =>
        c.transaction((ctx) =>
          manager.reserve(ctx, {
            orderId,
            itemId,
            quantity,
            locationId: c.loc(c.a),
          }),
        );
      const a = await reserve(first.id, item, "3");
      await reserve(first.id, extra, "6");
      await reserve(second.id, item, "2");
      const z = await reserve(zero.id, extra, "1");
      await c.transaction((ctx) =>
        manager.decrease(ctx, {
          reservationId: z.reservation.id,
          allocations: [{ locationId: c.loc(c.a), quantity: "1" }],
          deficitQuantity: "0",
        }),
      );
      await c.transaction((ctx) =>
        manager.reduceCoverage(ctx, {
          reservationId: a.reservation.id,
          locationId: c.loc(c.a),
          quantity: "2",
        }),
      );
      const get = (query, role = "keeper", status = 200) =>
        request(
          "GET",
          "/orders?" + new URLSearchParams(query),
          status,
          undefined,
          role,
        );
      const all = await get({ search: prefix });
      assert.equal(all.total, 2);
      const row = all.items.find((r) => r.order.id === first.id);
      assert.equal(row.positionsCount, 2);
      assert.equal(row.deficitPositionsCount, 1);
      assert.equal(row.order.closed, true);
      const summary = await request(
        "GET",
        `/orders/${first.id}/summary`,
        200,
        undefined,
        "keeper",
      );
      assert.deepEqual(summary, row);
      const empty = await request(
        "GET",
        `/orders/${zero.id}/summary`,
        200,
        undefined,
        "keeper",
      );
      assert.equal(empty.positionsCount, 0);
      assert.equal(empty.deficitPositionsCount, 0);
      await request(
        "GET",
        `/orders/${first.id}/summary`,
        403,
        undefined,
        "operator",
      );
      await request(
        "GET",
        `/orders/${randomUUID()}/summary`,
        404,
        undefined,
        "keeper",
      );
      await request("GET", "/orders/invalid/summary", 400, undefined, "keeper");
      for (const search of [prefix + "%_материал", "%_материал"]) {
        const found = await get({ search });
        assert.equal(found.total, 2);
        assert.equal(
          found.items.find((r) => r.order.id === first.id).positionsCount,
          2,
        );
      }
      await c.prisma.warehouseItem.update({
        where: { id: BigInt(extra) },
        data: { name: "Необычная номенклатура " + prefix },
      });
      const positions = (query, status = 200) =>
        request(
          "GET",
          "?" + new URLSearchParams({ orderId: first.id, ...query }),
          status,
          undefined,
          "keeper",
        );
      const articleMatch = await positions({ search: "%_материал" });
      assert.equal(articleMatch.total, 1);
      assert.equal(articleMatch.items[0].item.id, item);
      assert.equal(articleMatch.items[0].allocations.length, 1);
      assert.equal(articleMatch.items[0].deficitQuantity, "2");
      const nameMatch = await positions({
        search: "НЕОБЫЧНАЯ НОМЕНКЛАТУРА " + prefix,
      });
      assert.equal(nameMatch.total, 1);
      assert.equal(nameMatch.items[0].item.id, extra);
      assert.equal(
        (await positions({ search: prefix, deficit: "true" })).total,
        1,
      );
      assert.equal(
        (await positions({ search: prefix, limit: "1", page: "2" })).total,
        2,
      );
      const beyond = await positions({ search: prefix, limit: "1", page: "3" });
      assert.equal(beyond.total, 2);
      assert.deepEqual(beyond.items, []);
      assert.equal((await positions({ search: randomUUID() })).total, 0);
      await positions({ search: "x".repeat(256) }, 400);
      for (const search of [
        "имя заказа " + prefix,
        "необычная номенклатура " + prefix,
      ]) {
        assert.deepEqual(
          (await get({ search })).items.map((r) => r.order.id),
          [first.id],
        );
      }
      assert.deepEqual(
        (await get({ search: prefix, coverage: "DEFICIT" })).items.map(
          (r) => r.order.id,
        ),
        [first.id],
      );
      assert.deepEqual(
        (await get({ search: prefix, coverage: "COVERED" })).items.map(
          (r) => r.order.id,
        ),
        [second.id],
      );
      const page1 = await get({ search: prefix, limit: "1" });
      const page2 = await get({ search: prefix, limit: "1", page: "2" });
      assert.equal(page1.total, 2);
      assert.equal(page2.total, 2);
      assert.notEqual(page1.items[0].order.id, page2.items[0].order.id);
      assert.deepEqual(await get({ search: prefix, limit: "1", page: "3" }), {
        items: [],
        total: 2,
        page: 3,
        limit: 1,
      });
      assert.equal((await get({ search: randomUUID() })).total, 0);
      await get({}, "operator", 403);
      for (const query of [
        { coverage: "bad" },
        { page: "0" },
        { limit: "101" },
        { search: "x".repeat(256) },
        { unknown: "value" },
      ])
        await get(query, "admin", 400);
    },
  );
}
