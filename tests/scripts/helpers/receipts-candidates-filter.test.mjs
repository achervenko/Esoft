import assert from "node:assert/strict";
import { createCandidatesFixture } from "./receipts-candidates.fixtures.mjs";

export async function receiptsCandidatesFilter(prisma, t) {
  await t.test(
    "duplicate filter preserves business filters, totals and pages",
    async () => {
      const { c } = await createCandidatesFixture(prisma);
      const base = {
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        warehouseId: String(c.warehouse.id),
        sortBy: "createdAt",
        sortOrder: "desc",
      };
      for (const filter of [
        {},
        { source: "MANUAL" },
        { source: "ONE_C" },
        { search: "absent impossible" },
        { documentDateFrom: "2026-10-29", documentDateTo: "2026-10-29" },
        { itemId: String(c.item.id) },
      ]) {
        const q = { ...base, ...filter };
        const all = await c.queries.list({ ...q, limit: "100" });
        const expected = [];
        for (const row of all.items) {
          const detailed = await c.queries.reconciliationCandidates(row.id);
          assert.equal(
            row.hasReconciliationCandidates,
            detailed.items.length > 0,
          );
          if (detailed.items.length) expected.push(row);
        }
        const filtered = await c.queries.list({
          ...q,
          attention: "MANUAL_DUPLICATE",
          limit: "100",
        });
        assert.equal(filtered.total, expected.length);
        assert.deepEqual(
          filtered.items.map((r) => r.id),
          expected.map((r) => r.id),
        );
        for (const page of [1, 2, expected.length + 1]) {
          const result = await c.queries.list({
            ...q,
            attention: "MANUAL_DUPLICATE",
            limit: "1",
            page: String(page),
          });
          assert.equal(result.total, expected.length);
          assert.deepEqual(
            result.items.map((r) => r.id),
            expected.slice(page - 1, page).map((r) => r.id),
          );
        }
      }
    },
  );
}
