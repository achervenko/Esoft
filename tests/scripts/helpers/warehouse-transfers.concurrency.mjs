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
      "WAREHOUSE_STOCK_INSUFFICIENT",
      409,
    )(attempts.find((r) => r.status === "rejected").reason);
    assert.equal((await read(a)).quantity, "2");
  });
  await run("opposite transfers use the same Stock locks", async (ctx) => {
    const { actor, a, b, receive, read, service, payload } = ctx;

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
  });
}
