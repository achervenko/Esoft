import assert from "node:assert/strict";

export async function receiptsCandidates(c, t) {
  const source = c.source({ number: "КАНДИДАТ-1", date: "2026-10-29" });
  const target = await c.mapped(source);
  const manual = async (quantity = "10", patch = {}) => {
    const receipt = await c.manual(quantity, {
      documentDate: "2026-10-29",
      ...patch,
    });
    await c.place(receipt, quantity);
    return receipt;
  };
  const exact = await manual("10", { documentNumber: " кандидат-1 " });
  const differentQuantity = await manual("7", { documentNumber: "ДРУГОЙ" });
  const old = await manual("7", {
    documentDate: "2025-10-29",
    documentNumber: "КАНДИДАТ-1",
  });
  const nearby = await manual("10", { documentDate: "2026-10-28" });
  const weekBefore = await manual("10", { documentDate: "2026-10-22" });
  const weekAfter = await manual("10", { documentDate: "2026-11-05" });
  const tooEarly = await manual("10", { documentDate: "2026-10-21" });
  const tooLate = await manual("10", { documentDate: "2026-11-06" });
  const noDate = await manual("10", { documentDate: undefined });
  const numberWithoutDate = await manual("10", {
    documentDate: undefined,
    documentNumber: "КАНДИДАТ-1",
  });
  const oldUnrelatedNumber = await manual("10", { documentDate: "2025-10-29" });
  const partial = await c.manual("10", { documentDate: "2026-10-29" });
  await c.place(partial, "3");
  const pending = await c.manual("10", { documentDate: "2026-10-29" });
  const linked = await manual();
  const linkedTarget = await c.mapped(c.source({ date: "2026-10-29" }));
  await c.reconciliation.reconcile(
    linkedTarget.id,
    {
      manualReceiptId: linked.id,
      lines: [
        {
          manualLineId: linked.lines[0].id,
          receiptLineId: linkedTarget.lines[0].id,
        },
      ],
    },
    c.keeper.id,
  );
  const stock = await c.quantity();
  await t.test(
    "suggests by number or shared items within a week, compares exact decimals, reads never change stock",
    async () => {
      const result = await c.queries.reconciliationCandidates(target.id);
      const duplicates = await c.queries.list({
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        attention: "MANUAL_DUPLICATE",
        search: c.item.article,
        limit: "100",
      });
      assert.ok(duplicates.items.some((r) => r.id === target.id));
      assert.ok(duplicates.items.every((r) => r.hasReconciliationCandidates));
      const byName = await c.queries.list({
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        search: c.item.name,
        limit: "100",
      });
      assert.ok(byName.items.some((r) => r.id === target.id));

      const dated = await c.queries.list({
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        documentDateFrom: "2026-10-29",
        documentDateTo: "2026-10-29",
        limit: "100",
      });
      assert.ok(dated.items.some((r) => r.id === target.id));
      assert.ok(dated.items.some((r) => r.id === exact.id));
      assert.ok(!dated.items.some((r) => r.id === old.id));
      assert.ok(dated.items.every((r) => r.documentDate === "2026-10-29"));

      const summaries = await c.queries.list({
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        limit: "100",
      });
      assert.equal(
        summaries.items.find((r) => r.id === target.id)
          ?.hasReconciliationCandidates,
        true,
      );
      assert.equal(
        summaries.items.find((r) => r.id === pending.id)
          ?.hasReconciliationCandidates,
        false,
      );

      assert.equal(
        result.items.find((r) => r.id === partial.id)?.status,
        "PLACING",
      );
      const exactMatch = result.items.find((r) => r.id === exact.id);
      assert.ok(exactMatch);
      assert.equal(result.items[0].id, exact.id);
      assert.equal(exactMatch.sameNumber, true);
      assert.equal(exactMatch.sameItems, true);
      assert.equal(exactMatch.sameQuantities, true);
      assert.equal(exactMatch.matchedItems, 1);
      assert.equal(exactMatch.dateDistance, 0);
      const undatedMatch = result.items.find(
        (r) => r.id === numberWithoutDate.id,
      );
      assert.ok(undatedMatch);
      assert.equal(undatedMatch.sameNumber, true);
      assert.equal(undatedMatch.documentDate, null);
      assert.equal(undatedMatch.dateDistance, null);
      const quantityMatch = result.items.find(
        (r) => r.id === differentQuantity.id,
      );
      assert.ok(quantityMatch);
      assert.equal(quantityMatch.sameItems, true);
      assert.equal(quantityMatch.sameQuantities, false);
      const nearbyMatch = result.items.find((r) => r.id === nearby.id);
      assert.ok(nearbyMatch);
      assert.equal(nearbyMatch.dateDistance, 1);
      for (const boundary of [weekBefore, weekAfter])
        assert.equal(
          result.items.find((r) => r.id === boundary.id)?.dateDistance,
          7,
        );
      assert.equal(result.items.find((r) => r.id === old.id)?.sameNumber, true);
      for (const excluded of [
        oldUnrelatedNumber,
        tooEarly,
        tooLate,
        pending,
        linked,
        noDate,
      ])
        assert.ok(!result.items.some((r) => r.id === excluded.id));
      const unmatched = await c.mapped(
        c.source({
          date: "2026-10-29",
          lines: [{ ...source.lines[0], quantity: "11" }],
        }),
      );
      const differentTotalCandidates = (
        await c.queries.reconciliationCandidates(unmatched.id)
      ).items;
      assert.ok(
        differentTotalCandidates.some((r) => r.id === differentQuantity.id),
      );
      assert.ok(differentTotalCandidates.every((r) => !r.sameQuantities));
      const unmatchedSummary = (
        await c.queries.list({
          status: "RECEIVED,PLACING,PLACED,CANCELLED",
          limit: "100",
        })
      ).items.find((r) => r.id === unmatched.id);
      assert.equal(unmatchedSummary.hasReconciliationCandidates, true);
      assert.equal(await c.quantity(), stock);
    },
  );
  await t.test(
    "requires the same warehouse; number-only suggestions survive unresolved item identities",
    async () => {
      const foreign = await c.manual("10", {
        warehouseId: String(c.foreign.id),
        documentNumber: "КАНДИДАТ-1",
      });
      await c.place(foreign, "10", c.other.id);
      const differentItem = await c.prisma.warehouseItem.create({
        data: {
          article: `${c.namespace}-candidate-other`,
          name: "Other",
          unit: "шт",
        },
      });
      const unrelated = await c.manual("10", {
        documentDate: "2026-10-29",
        lines: [{ itemId: String(differentItem.id), quantity: "10" }],
      });
      await c.placements.place(
        unrelated.id,
        unrelated.lines[0].id,
        c.placement("10"),
        c.keeper.id,
      );
      const result = await c.queries.reconciliationCandidates(target.id);
      for (const excluded of [foreign, unrelated])
        assert.ok(!result.items.some((r) => r.id === excluded.id));
      const unmapped = await c.ingest(
        c.source({
          number: "КАНДИДАТ-1",
          lines: [
            {
              ...source.lines[0],
              item: { ...source.lines[0].item, id: "unmapped-candidate-item" },
            },
          ],
        }),
      );
      const numbered = (
        await c.queries.reconciliationCandidates(unmapped.id)
      ).items.find((r) => r.id === exact.id);
      assert.ok(numbered);
      const summary = (
        await c.queries.list({
          status: "RECEIVED,PLACING,PLACED,CANCELLED",
          limit: "100",
        })
      ).items.find((r) => r.id === unmapped.id);
      assert.equal(summary.unmappedLineCount, 1);
      const missingItems = await c.queries.list({
        attention: "ITEMS",
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        limit: "100",
      });
      assert.ok(missingItems.items.some((r) => r.id === unmapped.id));
      assert.ok(missingItems.items.every((r) => r.unmappedLineCount > 0));
      const missingWarehouse = await c.queries.list({
        attention: "WAREHOUSE",
        status: "RECEIVED,PLACING,PLACED,CANCELLED",
        limit: "100",
      });
      assert.ok(!missingWarehouse.items.some((r) => r.id === target.id));
      assert.ok(missingWarehouse.items.every((r) => r.warehouseId === null));

      assert.equal(summary.hasReconciliationCandidates, true);

      assert.equal(numbered.sameItems, false);
      assert.equal(numbered.sameQuantities, false);
    },
  );
  await t.test(
    "read suggestions do not bind; explicit reconciliation removes a candidate without increasing stock",
    async () => {
      const before = await c.quantity();
      await c.reconciliation.reconcile(
        target.id,
        {
          manualReceiptId: exact.id,
          lines: [
            {
              manualLineId: exact.lines[0].id,
              receiptLineId: target.lines[0].id,
            },
          ],
        },
        c.keeper.id,
      );
      assert.ok(
        !(await c.queries.reconciliationCandidates(target.id)).items.some(
          (r) => r.id === exact.id,
        ),
      );
      assert.equal(await c.quantity(), before);
      assert.deepEqual(await c.queries.reconciliationCandidates(exact.id), {
        items: [],
      });
      await assert.rejects(
        c.queries.reconciliationCandidates("9223372036854775807"),
        (e) =>
          e.status === 404 && e.response.code === "WAREHOUSE_RECEIPT_NOT_FOUND",
      );
    },
  );
  await t.test(
    "compares split lines using exact decimal sums and caps recommendations at ten",
    async () => {
      const target = await c.mapped(
        c.source({
          date: "2026-10-29",
          lines: [{ ...source.lines[0], quantity: "1" }],
        }),
      );
      const split = await c.manual("1", {
        documentDate: "2026-10-29",
        lines: [
          { itemId: String(c.item.id), quantity: "0.125" },
          { itemId: String(c.item.id), quantity: "0.875" },
        ],
      });
      await c.placements.place(
        split.id,
        split.lines[0].id,
        c.placement("0.125"),
        c.keeper.id,
      );
      await c.placements.place(
        split.id,
        split.lines[1].id,
        c.placement("0.875"),
        c.keeper.id,
      );
      const splitResult = await c.queries.reconciliationCandidates(target.id);
      assert.equal(
        splitResult.items.find((r) => r.id === split.id)?.sameQuantities,
        true,
      );
      for (let i = 0; i < 12; i++) await manual("1");
      const before = await c.quantity();
      const result = await c.queries.reconciliationCandidates(target.id);
      assert.equal(result.items.length, 10);
      assert.equal(result.items[0].sameQuantities, true);
      assert.equal(result.items[0].manualItems, 1);
      assert.equal(await c.quantity(), before);
    },
  );
}
