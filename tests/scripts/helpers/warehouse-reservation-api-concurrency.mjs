import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyApiConcurrency(
  c,
  t,
  {
    request,
    input,
    createOrder,
    admin,
    WarehouseReservationManager,
    WarehouseReservationsService,
  },
) {
  await t.test(
    "serializes concurrent HTTP commands and rolls back an audit write failure",
    async () => {
      const order = await createOrder("3");
      const { id: active } = await request("POST", "", 201, {
        ...input,
        orderId: order.id,
      });
      const path = "/" + active;
      const additions = await Promise.all(
        [1, 2].map(() =>
          request("POST", "", 201, {
            ...input,
            orderId: order.id,
            quantity: "1",
          }),
        ),
      );
      assert.ok(additions.every((row) => row.id === active));
      assert.equal((await request("GET", path, 200)).quantity, "5");
      const decreases = await Promise.all(
        [1, 2].map(() =>
          request("POST", path + "/decrease", undefined, {
            allocations: [{ locationId: c.loc(c.a), quantity: "3" }],
            deficitQuantity: "0",
            comment: "Проверка конкуренции",
          }),
        ),
      );
      assert.deepEqual(decreases.map((row) => row.status).sort(), [201, 409]);
      const decreased = await request("GET", path, 200);
      assert.equal(decreased.quantity, "2");
      assert.equal(decreased.coveredQuantity, "2");
      assert.equal(decreased.deficitQuantity, "0");
      const reduced = await request("POST", path + "/coverage/reduce", 201, {
        locationId: c.loc(c.a),
        quantity: "1",
        comment: "Создание дефицита перед конкурентным восстановлением",
      });
      assert.equal(reduced.deficitQuantity, "1");
      const restores = await Promise.all(
        [1, 2].map(() =>
          request("POST", path + "/coverage/restore", undefined, {
            locationId: c.loc(c.a),
            quantity: "1",
            comment: "Проверка конкуренции",
          }),
        ),
      );
      assert.deepEqual(restores.map((row) => row.status).sort(), [201, 409]);
      assert.equal(
        restores.find((row) => row.status === 409).result.code,
        "WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT",
      );
      const restored = restores.find((row) => row.status === 201).result;
      assert.equal(restored.coveredQuantity, "2");
      assert.equal(restored.deficitQuantity, "0");
      const failingManager = new WarehouseReservationManager(
        {
          writeFieldChanges: (params) =>
            c.audit.writeFieldChanges({ ...params, userId: randomUUID() }),
        },
        c.stock,
      );
      const failing = new WarehouseReservationsService(
        c.prisma,
        failingManager,
      );
      const before = await request("GET", path, 200);
      const historyBefore = await request("GET", path + "/history", 200);
      await assert.rejects(
        failing.reserve(
          { ...input, orderId: order.id, quantity: "1", comment: "Откат" },
          admin.id,
        ),
        { code: "P2003" },
      );
      assert.deepEqual(await request("GET", path, 200), before);
      assert.deepEqual(
        await request("GET", path + "/history", 200),
        historyBefore,
      );
    },
  );
}
