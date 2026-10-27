import assert from "node:assert/strict";
import { hasCode } from "./warehouse-transfers-test-context.mjs";

export async function verifyTransfersIdempotency(run) {
  await run("concurrent replay and conflicting request key", async (ctx) => {
    const { actor, a, receive, read, service, payload } = ctx;

    await receive(a, "10");
    const input = payload("2");
    const results = await Promise.all(
      Array.from({ length: 6 }, () => service.create(input, actor.id)),
    );
    assert.equal(new Set(results.map((r) => r.id)).size, 1);
    assert.equal((await read(a)).quantity, "8");

    await assert.rejects(
      service.create({ ...input, quantity: "1" }, actor.id),
      hasCode("WAREHOUSE_TRANSFER_REQUEST_CONFLICT", 409),
    );
  });
  await run(
    "audit failure rolls back both balances, transfer and key",
    async (ctx) => {
      const { prisma, reservations, WarehouseTransfersService } = ctx;

      const { actor, a, b, receive, read, stock, payload } = ctx;
      await receive(a, "10");
      const input = payload();
      const before = await prisma.auditLog.count();
      const broken = new WarehouseTransfersService(
        prisma,
        stock,
        reservations,
        {
          writeFieldChanges: async () => {
            throw Error("Transfer audit unavailable");
          },
        },
      );
      await assert.rejects(
        broken.create(input, actor.id),
        /Transfer audit unavailable/,
      );
      assert.equal((await read(a)).quantity, "10");
      assert.equal(await read(b), null);
      assert.equal(
        await prisma.warehouseTransfer.count({
          where: { createdByUserId: actor.id },
        }),
        0,
      );
      assert.equal(await prisma.auditLog.count(), before);
      await ctx.service.create(input, actor.id);
      assert.equal((await read(a)).quantity, "8");
    },
  );
}
