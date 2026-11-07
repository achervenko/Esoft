import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
export async function verifySample(context, t) {
  const { c, first, source, service, refresh, find, state } = context;
  if (process.env.ESOFT_ORDERS_SAMPLE_FILE) {
    await t.test(
      "provided export spans pages and preserves counts and source values",
      async () => {
        const data = JSON.parse(
          (
            await readFile(process.env.ESOFT_ORDERS_SAMPLE_FILE, "utf8")
          ).replace(/^\uFEFF/, ""),
        );
        assert.ok(Array.isArray(data.value) && data.value.length > 0);
        assert.equal(
          new Set(data.value.map((row) => row.Ref_Key.toLowerCase())).size,
          data.value.length,
        );
        // Missing fields are synthetic only in this isolated test; the production parser stays strict.
        state.rows = data.value.map((row) => ({
          Date: "2026-11-06T00:00:00",
          Posted: true,
          DeletionMark: false,
          ...row,
        }));
        const externalIds = state.rows.map((row) => row.Ref_Key.toLowerCase());
        const unrelatedClosed = await c.prisma.customerOrder.count({
          where: {
            sourceId: source.id,
            externalId: { notIn: externalIds },
            status: "Закрыт",
            posted: true,
            deletionMark: false,
          },
        });
        assert.equal((await refresh()).received, state.rows.length);
        const imported = await c.prisma.customerOrder.findMany({
          where: { sourceId: source.id, externalId: { in: externalIds } },
        });
        assert.equal(imported.length, state.rows.length);
        const byId = new Map(imported.map((row) => [row.externalId, row]));
        for (const row of data.value) {
          const actual = byId.get(row.Ref_Key.toLowerCase());
          assert.equal(actual.number, row.Number);
          assert.equal(actual.name, row.IR_Проект);
          assert.equal(actual.status, row.Статус);
        }
        assert.equal(
          (await refresh()).changed,
          externalIds.includes(first.Ref_Key) ? 0 : 1,
        );
        assert.equal(
          (await service.list({ sourceId: source.id, closed: "true" })).total,
          state.rows.filter(
            (row) => row.Статус === "Закрыт" && row.Posted && !row.DeletionMark,
          ).length + unrelatedClosed,
        );
        const nonempty = state.rows.find((row) => row.IR_Проект.trim());
        if (nonempty) {
          const found = await service.list({
            search: nonempty.IR_Проект,
            sourceId: source.id,
          });
          assert.ok(found.total > 0);
          assert.ok(
            found.items.some(
              (row) => row.externalId === nonempty.Ref_Key.toLowerCase(),
            ),
          );
        }
      },
    );
  }
}
