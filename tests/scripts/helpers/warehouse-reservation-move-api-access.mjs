import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyMoveApiAccess(
  c,
  t,
  { request, admin, keeper, fixture },
) {
  await t.test(
    "validates authorization and parameters and never commits a rejected move",
    async () => {
      const f = await fixture();
      await f.move(f.command, 403, "keeper");
      await f.move(f.command, 403, "operator");
      await c.prisma.user.update({
        where: { id: admin.id },
        data: { banned: true },
      });
      await f.move(f.command, 403);
      await c.prisma.user.update({
        where: { id: admin.id },
        data: { banned: false },
      });
      for (const body of [
        { ...f.command, extra: true },
        { ...f.command, quantity: 1 },
        { ...f.command, quantity: "0" },
        { ...f.command, quantity: "-1" },
        { ...f.command, quantity: "0.0001" },
        { ...f.command, fromLocationId: "bad" },
        { ...f.command, toLocationId: c.loc(c.a) },
        { ...f.command, requestKey: "bad" },
        { ...f.command, comment: "x".repeat(4001) },
      ])
        await f.move(body, 400);
      await request("POST", "/bad/move", 400, f.command);
      await request("POST", "/" + randomUUID() + "/move", 404, f.command);
      await f.move({ ...f.command, toLocationId: "9223372036854775807" }, 404);
      await f.move({ ...f.command, quantity: "9" }, 409);
      await c.prisma.warehouseStorageLocation.update({
        where: { id: c.b.id },
        data: { isActive: false },
      });
      await f.move(f.command, 409);
      await c.prisma.warehouseStorageLocation.update({
        where: { id: c.b.id },
        data: { isActive: true },
      });
      await c.prisma.warehouse.update({
        where: { id: c.a.warehouseId },
        data: { isActive: false },
      });
      await f.move(f.command, 409);
      await c.prisma.warehouse.update({
        where: { id: c.a.warehouseId },
        data: { isActive: true },
      });
      await c.prisma.warehouseItem.update({
        where: { id: BigInt(f.itemId) },
        data: { isActive: false },
      });
      await f.move(f.command, 409);
      await c.prisma.warehouseItem.update({
        where: { id: BigInt(f.itemId) },
        data: { isActive: true },
      });
      assert.equal((await f.state()).transfers, 0);
      assert.equal((await f.state()).reserve.coveredQuantity, "8");
      await c.prisma.user.update({
        where: { id: keeper.id },
        data: { banned: true },
      });
      await f.move(f.command, 403, "keeper");
    },
  );
}
