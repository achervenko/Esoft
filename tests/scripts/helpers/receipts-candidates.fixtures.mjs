import { createReceiptTestContext } from "./warehouse-receipts-test-context.mjs";

export async function createCandidatesFixture(prisma) {
  const c = await createReceiptTestContext(prisma);
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
  return {
    c,
    source,
    target,
    manual,
    exact,
    differentQuantity,
    old,
    nearby,
    weekBefore,
    weekAfter,
    tooEarly,
    tooLate,
    noDate,
    numberWithoutDate,
    oldUnrelatedNumber,
    partial,
    pending,
    linked,
    stock,
  };
}
