import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function verifyAccess(context, t) {
  const { c, source, sync, refresh, find } = context;
  await t.test(
    "permission recheck, disabled flow and deletion restrictions",
    async () => {
      const keeper = await c.prisma.user.create({
        data: {
          id: randomUUID(),
          name: "keeper",
          email: `${randomUUID()}@test.invalid`,
          role: "storekeeper",
        },
      });
      await assert.rejects(
        () => sync.sync(source.id, keeper.id),
        (e) => e.getStatus?.() === 403,
      );
      await c.sources.configureFlow(
        source.code,
        "orders.customers",
        { isActive: false, configVersion: 1, config: {} },
        c.admin.id,
      );
      await assert.rejects(refresh(), (e) => e.getStatus?.() === 409);
      const order = await find();
      await assert.rejects(() =>
        c.prisma.customerOrder.delete({ where: { id: order.id } }),
      );
      assert.ok(await find());
      await assert.rejects(() =>
        c.keys.create(
          source.code,
          {
            name: "no incoming orders",
            flows: { "orders.customers": ["event:create"] },
          },
          c.admin.id,
        ),
      );
    },
  );
}
