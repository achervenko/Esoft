import assert from "node:assert/strict";
import { hasCode } from "./warehouse-transfers-test-context.mjs";

export async function verifyTransfersConsolidation(run) {
  await run(
    "consolidation moves multiple locations atomically across warehouses with replay",
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
      await receive(a, "10");
      await receive(b, "4");
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
          { fromLocationId: String(a.id), quantity: "10" },
          { fromLocationId: String(b.id), quantity: "4" },
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
      assert.equal(results[0].ids.length, 2);
      assert.equal((await read(a)).quantity, "0");
      assert.equal((await read(b)).quantity, "0");
      assert.equal((await read(target)).quantity, "14");
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
