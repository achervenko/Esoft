import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
export async function verifyBasic(context, t) {
  const { c, first, service, refresh, find, state } = context;
  await t.test(
    "initial load, empty name, stable identity and unchanged replay",
    async () => {
      assert.deepEqual(await refresh(), {
        outcome: "SUCCESS",
        received: 1,
        changed: 1,
      });
      const before = await find();
      assert.equal(before.name, "");
      assert.equal((await refresh()).changed, 0);
      const after = await find();
      assert.equal(after.id, before.id);
      assert.equal(
        after.changedAt.toISOString(),
        before.changedAt.toISOString(),
      );
      assert.equal(
        await c.prisma.customerOrderChange.count({
          where: { orderId: before.id },
        }),
        1,
      );
    },
  );
  await t.test(
    "unknown statuses, flags and repeated closing are faithfully recorded",
    async () => {
      for (const status of ["Закрыт", "ДругойСтатус", "Закрыт"]) {
        state.rows = [
          {
            ...first,
            Number: "renamed",
            Статус: status,
            Posted: false,
            DeletionMark: true,
          },
        ];
        assert.equal((await refresh()).changed, 1);
      }
      assert.equal((await refresh()).changed, 0);
      const order = await find();
      const history = await service.history(order.id, {});
      assert.equal(history.total, 4);
      assert.equal(
        history.items.filter(
          (h) => h.before?.status !== "Закрыт" && h.after.status === "Закрыт",
        ).length,
        2,
      );
      assert.equal(order.posted, false);
      assert.equal(order.deletionMark, true);
      for (const query of [
        {},
        { closed: "true" },
        { search: "renamed" },
        { deleted: "all" },
      ]) {
        const listed = await service.list(query);
        assert.equal(listed.total, 0);
      }
      state.rows = [];
      await refresh();
      assert.equal((await find()).status, "Закрыт");
      assert.equal(await c.prisma.customerOrder.count(), 1);
    },
  );
}

export async function verifyListFilters({ c, service }, t) {
  await t.test(
    "list filters combine statuses and deletion and exclude unposted orders",
    async () => {
      const template = await c.prisma.customerOrder.findFirstOrThrow();
      const search = randomUUID();
      for (const [status, posted, deletionMark] of [
        ["КОбеспечению", true, false],
        ["Закрыт", true, false],
        ["НовыйСтатус", true, false],
        ["КОбеспечению", true, true],
        ["КОбеспечению", false, false],
      ]) {
        await c.prisma.customerOrder.create({
          data: {
            ...template,
            id: randomUUID(),
            externalId: randomUUID(),
            number: search,
            status,
            posted,
            deletionMark,
          },
        });
      }
      assert.equal((await service.list({ search })).total, 3);
      assert.equal((await service.list({ search, deleted: "all" })).total, 4);
      assert.equal((await service.list({ search, deleted: "true" })).total, 1);
      const filtered = await service.list({
        search,
        statuses: JSON.stringify(["КОбеспечению", "Закрыт"]),
      });
      assert.equal(filtered.total, 2);
      assert.ok(filtered.statuses.includes("НовыйСтатус"));
    },
  );
}
