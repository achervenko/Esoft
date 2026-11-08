import assert from "node:assert/strict";

export async function verifyApiList(
  c,
  t,
  { request, input, closed, second },
  id,
) {
  await t.test(
    "filters and paginates a consistent view including empty reserves",
    async () => {
      const positive = await request("POST", "", 201, {
        ...input,
        orderId: second.id,
      });
      const item = "?itemId=" + c.id;
      assert.deepEqual(
        (await request("GET", item, 200)).items.map((row) => row.id),
        [positive.id],
      );
      assert.deepEqual(
        (
          await request(
            "GET",
            item + "&quantityState=ZERO&covered=false&deficit=false",
            200,
          )
        ).items.map((row) => row.id),
        [id],
      );
      const list = await request(
        "GET",
        item + "&quantityState=ALL&limit=1",
        200,
      );
      assert.equal(list.total, 2);
      assert.deepEqual(
        list.items.map((row) => row.id),
        [positive.id],
      );
      assert.deepEqual(
        (
          await request("GET", item + "&quantityState=ALL&limit=1&page=2", 200)
        ).items.map((row) => row.id),
        [id],
      );
      assert.deepEqual(
        await request("GET", item + "&quantityState=ALL&limit=1&page=3", 200),
        { items: [], total: 2, page: 3, limit: 1 },
      );
      await request("POST", "/" + positive.id + "/coverage/reduce", 201, {
        locationId: c.loc(c.a),
        quantity: "1",
        comment: "Проверка фильтра",
      });
      const filtered = await request(
        "GET",
        item + "&orderId=" + second.id + "&deficit=true&covered=true",
        200,
      );
      assert.equal(filtered.items[0].deficitQuantity, "1");
      assert.equal(filtered.items[0].coveredQuantity, "2");
      assert.equal(filtered.total, 1);
      assert.equal(
        (
          await request(
            "GET",
            item + "&orderId=" + closed.id + "&deficit=true",
            200,
          )
        ).total,
        0,
      );
      assert.equal((await request("GET", "/" + id, 200)).quantity, "0");
      await request("GET", "?deficit=yes", 400);
    },
  );
}

export async function verifyApiHistory(
  c,
  t,
  { request, input, manager, admin },
  id,
) {
  await t.test(
    "preserves the history of internal moves and consumption after exhaustion",
    async () => {
      const result = await request("POST", "", 201, {
        ...input,
        quantity: "2",
      });
      assert.equal(result.id, id);
      const reservationId = result.id;
      await c.transaction(async ({ tx }) => {
        const context = { tx, actorUserId: admin.id };
        await manager.move(context, {
          reservationId,
          fromLocationId: c.loc(c.a),
          toLocationId: c.loc(c.b),
          quantity: "2",
        });
        await manager.consume(context, {
          reservationId,
          locationId: c.loc(c.b),
          quantity: "2",
        });
      });
      const path = "/" + reservationId;
      assert.equal((await request("GET", path, 200)).quantity, "0");
      const { items, total } = await request(
        "GET",
        path + "/history?limit=2",
        200,
      );
      assert.equal(total, 10);
      assert.deepEqual(
        items.map((row) => row.operation),
        ["CONSUME", "MOVE"],
      );
      assert.equal(items[0].details.after, "0");
      assert.equal(items[1].details.from.locationId, c.loc(c.a));
      assert.equal(items[1].details.to.locationId, c.loc(c.b));
    },
  );
}
