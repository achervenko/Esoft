import assert from "node:assert/strict";
import { hasCode } from "./warehouse-transfers-test-context.mjs";

export async function verifyTransfersConcurrency(run) {
  await run("distinct transfers cannot overspend", async (ctx) => {
    const { actor, a, receive, read, service, payload } = ctx;

    await receive(a, "8");
    const attempts = await Promise.allSettled([
      service.create(payload("6"), actor.id),
      service.create(payload("6"), actor.id),
    ]);
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    hasCode(
      "WAREHOUSE_TRANSFER_RESERVED_STOCK",
      409,
    )(attempts.find((r) => r.status === "rejected").reason);
    assert.equal((await read(a)).quantity, "2");
  });
  await run(
    "opposite transfers and reservation race use the same Stock locks",
    async (ctx) => {
      const {
        prisma,
        reservationsApi,
        actor,
        a,
        b,
        receive,
        read,
        service,
        payload,
        namespace,
      } = ctx;

      await receive(a, "10");
      await receive(b, "10");
      await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          service.create(
            i % 2
              ? payload("1")
              : {
                  ...payload("1"),
                  fromLocationId: String(b.id),
                  toLocationId: String(a.id),
                },
            actor.id,
          ),
        ),
      );
      assert.equal((await read(a)).quantity, "10");
      assert.equal((await read(b)).quantity, "10");
      const api = reservationsApi;
      const project = await prisma.warehouseProject.create({
        data: { projectNumber: namespace + "-race" },
      });
      const balance = await read(a);
      const race = await Promise.allSettled([
        service.create(payload("6"), actor.id),
        api.create(
          {
            balanceId: balance.id,
            projectId: String(project.id),
            quantity: "8",
          },
          actor.id,
        ),
      ]);
      assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
      const failure = race.find((r) => r.status === "rejected").reason;
      assert.equal(failure.getStatus(), 409);
      assert.ok(
        [
          "WAREHOUSE_TRANSFER_RESERVED_STOCK",
          "WAREHOUSE_RESERVATION_INSUFFICIENT",
        ].includes(failure.response.code),
      );
      const remaining = await read(a);
      const totalReserved = (
        await prisma.warehouseProjectReservation.aggregate({
          where: { balanceId: BigInt(balance.id) },
          _sum: { quantity: true },
        })
      )._sum.quantity;
      assert.ok(!totalReserved || totalReserved.lte(remaining.quantity));
    },
  );
}
