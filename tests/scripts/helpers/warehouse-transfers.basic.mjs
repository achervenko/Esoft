import assert from "node:assert/strict";

export async function verifyTransfersBasic(run) {
  await run(
    "movement, snapshots, list filters, cross-warehouse and zero source",
    async (ctx) => {
      const {
        prisma,
        actor,
        stock,
        a,
        b,
        c,
        id,
        loc,
        receive,
        read,
        service,
        payload,
        namespace,
      } = ctx;

      await receive(a, "10");
      const input = payload("10");
      const result = await service.create(input, actor.id);
      assert.equal(result.quantity, "10");
      assert.equal((await read(a)).quantity, "0");
      assert.equal((await read(b)).quantity, "10");
      assert.equal(await stock.getItemTotal(id), "10");
      assert.equal(result.snapshot.fromQuantityBefore, "10");
      await prisma.warehouseItem.update({
        where: { id: BigInt(id) },
        data: { name: "Renamed", isActive: false },
      });
      await prisma.warehouseStorageLocation.update({
        where: { id: a.id },
        data: { name: "Renamed", isActive: false },
      });
      assert.deepEqual(await service.findOne(result.id), result);
      assert.deepEqual(await service.create(input, actor.id), result);
      await prisma.warehouseItem.update({
        where: { id: BigInt(id) },
        data: { isActive: true },
      });
      const foreign = await prisma.warehouse.create({
        data: { code: namespace + "-foreign", name: "Foreign" },
      });
      const target = await prisma.warehouseStorageLocation.create({
        data: { warehouseId: foreign.id, code: "A", name: "Foreign" },
      });
      const cross = await service.create(
        { ...payload(), fromLocationId: loc(b), toLocationId: loc(target) },
        actor.id,
      );
      assert.equal(cross.snapshot.to.warehouseId, String(foreign.id));
      assert.equal(await stock.getItemTotal(id, String(foreign.id)), "2");
      const filtered = await service.list({ warehouseId: String(foreign.id) });
      assert.equal(filtered.total, 1);
      assert.equal(filtered.items[0].id, cross.id);
      const own = await service.list({
        warehouseId: String(a.warehouseId),
        itemId: id,
        limit: "1",
        page: "2",
      });
      assert.equal(own.total, 2);
      assert.equal(own.items.length, 1);
      assert.equal((await service.list({ fromLocationId: loc(c) })).total, 0);
    },
  );
}
