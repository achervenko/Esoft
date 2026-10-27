import assert from "node:assert/strict";
import { hasCode } from "./warehouse-transfers-test-context.mjs";

export async function verifyTransfersReservations(run) {
  await run("reserves stay at source and cannot be moved", async (ctx) => {
    const {
      prisma,
      actor,
      a,
      b,
      id,
      receive,
      read,
      service,
      payload,
      namespace,
    } = ctx;

    const balance = await receive(a, "20");
    const project = await prisma.warehouseProject.create({
      data: { projectNumber: namespace },
    });
    const reserve = await prisma.warehouseProjectReservation.create({
      data: {
        balanceId: BigInt(balance.id),
        projectId: project.id,
        quantity: "8",
      },
    });
    await assert.rejects(
      service.create(payload("13"), actor.id),
      hasCode("WAREHOUSE_TRANSFER_RESERVED_STOCK", 409),
    );
    assert.equal(await read(b), null);
    await service.create(payload("12"), actor.id);
    assert.equal((await read(a)).quantity, "8");
    assert.equal(
      (
        await prisma.warehouseProjectReservation.findUniqueOrThrow({
          where: { id: reserve.id },
        })
      ).quantity.toString(),
      "8",
    );
    assert.equal(
      await prisma.warehouseProjectReservation.count({
        where: { balance: { itemId: BigInt(id), storageLocationId: b.id } },
      }),
      0,
    );
  });
}
