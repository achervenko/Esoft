import assert from "node:assert/strict";
import { hasCode } from "./warehouse-transfers-test-context.mjs";

export async function verifyTransfersConsolidation(run) {
  await run(
    "consolidation moves multiple locations and projects atomically across warehouses with replay",
    async ({
      prisma,
      actor,
      a,
      b,
      id,
      receive,
      read,
      consolidation,
      namespace,
    }) => {
      const source = await receive(a, "10");
      const second = await receive(b, "4");
      const project = await prisma.warehouseProject.create({
        data: { projectNumber: namespace },
      });
      const otherProject = await prisma.warehouseProject.create({
        data: { projectNumber: namespace + "-other" },
      });
      await prisma.warehouseProjectReservation.create({
        data: {
          balanceId: BigInt(second.id),
          projectId: otherProject.id,
          quantity: "2",
        },
      });
      await prisma.warehouseProjectReservation.create({
        data: {
          balanceId: BigInt(source.id),
          projectId: project.id,
          quantity: "6",
        },
      });
      const warehouse = await prisma.warehouse.create({
        data: { name: namespace + "-target" },
      });
      const target = await prisma.warehouseStorageLocation.create({
        data: { warehouseId: warehouse.id, name: "Target" },
      });
      const payload = {
        requestKey: crypto.randomUUID(),
        itemId: id,
        fromWarehouseId: String(a.warehouseId),
        toLocationId: String(target.id),
        moves: [
          { fromLocationId: String(a.id), quantity: "4" },
          {
            fromLocationId: String(a.id),
            quantity: "6",
            projectId: String(project.id),
          },
          { fromLocationId: String(b.id), quantity: "2" },
          {
            fromLocationId: String(b.id),
            quantity: "2",
            projectId: String(otherProject.id),
          },
        ],
      };
      const results = await Promise.all([
        consolidation.consolidate(payload, actor.id),
        consolidation.consolidate(
          { ...payload, moves: [...payload.moves].reverse() },
          actor.id,
        ),
      ]);
      assert.deepEqual(results[0], results[1]);
      assert.equal(results[0].ids.length, 4);
      assert.equal((await read(a)).quantity, "0");
      assert.equal((await read(b)).quantity, "0");
      assert.equal((await read(target)).quantity, "14");
      const reserve = await prisma.warehouseProjectReservation.findFirstOrThrow(
        { where: { projectId: project.id } },
      );
      assert.equal(reserve.quantity.toString(), "6");
      assert.equal(String(reserve.balanceId), (await read(target)).id);
      const otherReserve =
        await prisma.warehouseProjectReservation.findFirstOrThrow({
          where: { projectId: otherProject.id },
        });
      assert.equal(otherReserve.quantity.toString(), "2");
      assert.equal(otherReserve.balanceId, reserve.balanceId);
      await assert.rejects(
        consolidation.consolidate(
          {
            ...payload,
            moves: [
              { ...payload.moves[0], quantity: "3" },
              ...payload.moves.slice(1),
            ],
          },
          actor.id,
        ),
        hasCode("WAREHOUSE_TRANSFER_REQUEST_CONFLICT", 409),
      );
    },
  );
  await run(
    "consolidation rolls back earlier transfers if a later location has insufficient stock",
    async ({ prisma, actor, a, b, id, receive, read, consolidation }) => {
      await receive(a, "5");
      await receive(b, "1");
      const before = await prisma.warehouseTransfer.count({
        where: { createdByUserId: actor.id },
      });
      const payload = {
        requestKey: crypto.randomUUID(),
        itemId: id,
        fromWarehouseId: String(a.warehouseId),
        toLocationId: String(
          (
            await prisma.warehouseStorageLocation.create({
              data: { warehouseId: a.warehouseId, name: crypto.randomUUID() },
            })
          ).id,
        ),
        moves: [
          { fromLocationId: String(a.id), quantity: "5" },
          { fromLocationId: String(b.id), quantity: "2" },
        ],
      };
      await assert.rejects(consolidation.consolidate(payload, actor.id));
      assert.equal((await read(a)).quantity, "5");
      assert.equal((await read(b)).quantity, "1");
      assert.equal(
        await prisma.warehouseTransfer.count({
          where: { createdByUserId: actor.id },
        }),
        before,
      );
      const replay = await consolidation.consolidate(
        {
          ...payload,
          moves: [payload.moves[0], { ...payload.moves[1], quantity: "1" }],
        },
        actor.id,
      );
      assert.equal(replay.ids.length, 2);
    },
  );
}
