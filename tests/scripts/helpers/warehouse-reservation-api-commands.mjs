import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyApiCommands(
  c,
  t,
  { request, closed, input, admin },
) {
  let id;
  await t.test(
    "creates and increases one closed-order reserve across locations with warnings",
    async () => {
      const order = await request(
        "GET",
        "/orders/" + closed.id,
        200,
        undefined,
        "admin",
      );
      assert.equal(order.closed, true);
      assert.equal(order.warnings[0].code, "ORDER_CLOSED");
      const created = await request("POST", "", 201, {
        ...input,
        comment: "  Для заказа  ",
      });
      id = created.id;
      assert.equal(created.warnings[0].code, "ORDER_CLOSED");
      assert.equal(created.quantity, "3");
      assert.equal(created.allocations[0].location.id, input.locationId);
      assert.equal(created.allocations[0].quantity, "3");
      assert.equal((await request("POST", "", 201, input)).id, id);
      const next = await request("POST", "", 201, {
        ...input,
        locationId: c.loc(c.b),
        quantity: "2",
      });
      assert.equal(next.id, id);
      assert.equal(next.quantity, "8");
      assert.equal(next.coveredQuantity, "8");
      assert.equal(next.deficitQuantity, "0");
      assert.deepEqual(next.allocations.map((row) => row.quantity).sort(), [
        "2",
        "6",
      ]);
      assert.equal(
        (await request("POST", "", 409, { ...input, quantity: "5" })).code,
        "WAREHOUSE_RESERVATION_INSUFFICIENT",
      );
      assert.equal(
        (await request("POST", "", 404, { ...input, orderId: randomUUID() }))
          .code,
        "WAREHOUSE_RESERVATION_ORDER_NOT_FOUND",
      );
      assert.equal(
        (
          await request("POST", "", 404, {
            ...input,
            itemId: "9223372036854775807",
          })
        ).code,
        "WAREHOUSE_ITEM_NOT_FOUND",
      );
      assert.equal(
        (
          await request("POST", "", 404, {
            ...input,
            locationId: "9223372036854775807",
          })
        ).code,
        "WAREHOUSE_LOCATION_NOT_FOUND",
      );
      await request("POST", "", 400, { ...input, quantity: 2 });
    },
  );

  await t.test(
    "changes coverage and releases both covered quantity and deficit with reasons",
    async () => {
      const path = "/" + id;
      await request("GET", path, 403, undefined, "operator");
      await request("GET", path + "/history", 403, undefined, "operator");
      const details = await request("GET", path, 200, undefined, "keeper");
      assert.equal(details.order.closed, true);
      await request("POST", path + "/decrease", 403, {}, "keeper");
      const placement = { locationId: c.loc(c.a), quantity: "2" };
      const release = {
        allocations: [{ ...placement, quantity: "1" }],
        deficitQuantity: "1",
      };
      for (const comment of [undefined, "   "])
        await request("POST", path + "/decrease", 400, {
          ...release,
          comment,
        });
      await request("POST", path + "/coverage/reduce", 400, {
        ...placement,
        comment: " ",
      });
      const reduced = await request("POST", path + "/coverage/reduce", 201, {
        ...placement,
        comment: "Недостача",
      });
      assert.equal(reduced.quantity, "8");
      assert.equal(reduced.coveredQuantity, "6");
      assert.equal(reduced.deficitQuantity, "2");
      await request("POST", path + "/coverage/restore", 409, {
        ...placement,
        quantity: "3",
        comment: "Восстановление",
      });
      const restored = await request("POST", path + "/coverage/restore", 201, {
        ...placement,
        quantity: "1",
        comment: "Восстановление",
      });
      assert.equal(restored.deficitQuantity, "1");
      const partial = await request("POST", path + "/decrease", 201, {
        ...release,
        comment: "Частично снято",
      });
      assert.equal(partial.quantity, "6");
      assert.equal(partial.deficitQuantity, "0");
      const full = await request("POST", path + "/decrease", 201, {
        allocations: partial.allocations.map((row) => ({
          locationId: row.location.id,
          quantity: row.quantity,
        })),
        deficitQuantity: "0",
        comment: "Полностью снято",
      });
      assert.equal(full.id, id);
      assert.equal(full.quantity, "0");
      assert.deepEqual(full.allocations, []);
      assert.equal((await c.read(c.a)).quantity, "10");
      assert.equal((await c.read(c.b)).quantity, "6");
      const history = await request(
        "GET",
        path + "/history?limit=20",
        200,
        undefined,
        "keeper",
      );
      assert.equal(history.total, 7);
      assert.deepEqual(
        history.items.map((row) => row.operation),
        [
          "RELEASE",
          "DECREASE",
          "RESTORE_COVERAGE",
          "REDUCE_COVERAGE",
          "INCREASE",
          "INCREASE",
          "CREATE",
        ],
      );
      assert.deepEqual(
        history.items.map((row) => row.details.comment),
        [
          "Полностью снято",
          "Частично снято",
          "Восстановление",
          "Недостача",
          undefined,
          undefined,
          "Для заказа",
        ],
      );
      assert.ok(
        history.items.every(
          (row) => row.userId === admin.id && row.reservationId === id,
        ),
      );
      assert.equal(
        (await request("GET", path + "/history?limit=1&page=2", 200)).items[0]
          .operation,
        "DECREASE",
      );
    },
  );
  return id;
}
