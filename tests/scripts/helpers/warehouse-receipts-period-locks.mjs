import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export async function waitForAdvisoryLock(prisma, holder) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [row] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_locks held JOIN pg_locks waiting
          USING (locktype, database, classid, objid, objsubid)
        WHERE held.pid=${holder}::int AND held.locktype='advisory'
          AND held.granted AND NOT waiting.granted
      ) AS waiting`;
    if (row.waiting) return;
    await delay(20);
  }
  assert.fail("Import did not wait for the held advisory lock");
}

export async function verifyReceiptPeriodLocks(c, t, fixture, first) {
  const { a, b, invoice, item, service, warehouses } = fixture;
  await t.test(
    "single and batch imports lock shared item before shared warehouse",
    async (t) => {
      const locked = Promise.withResolvers();
      const resume = Promise.withResolvers();
      const lockIdentities = c.links.lockIdentities.bind(c.links);
      t.mock.method(
        c.links,
        "lockIdentities",
        async (tx, identities) => {
          await lockIdentities(tx, identities);
          const [row] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          locked.resolve(row.pid);
          await resume.promise;
        },
        { times: 1 },
      );
      const doc = c.source({
        warehouse: { id: warehouses[0], name: "External" },
      });
      doc.lines[0].item.id = item;
      const single = c.prisma.$transaction(
        (tx) => c.importer.apply(tx, a.code, doc, c.admin.id),
        { timeout: 15000 },
      );
      const holder = await Promise.race([
        locked.promise,
        single.then(() => assert.fail("Single import did not reach the gate")),
      ]);
      const batch = service.reprocess(b.code, invoice.id);
      try {
        await waitForAdvisoryLock(c.prisma, holder);
        const key = JSON.stringify([
          "warehouse:warehouse-link",
          "ONE_C",
          warehouses[0],
        ]);
        const [row] = await c.prisma
          .$queryRaw`SELECT pg_try_advisory_xact_lock(hashtextextended(${key},0)) AS available`;
        assert.equal(row.available, true, "Warehouse must still be unlocked");
      } finally {
        resume.resolve();
        const [document, imported] = await Promise.all([single, batch]);
        assert.equal(document.conflict, null);
        assert.equal(imported.outcome, "PROCESSED");
      }
    },
  );
  await t.test(
    "single snapshot and batch import share warehouse-before-receipt ordering for the same receipt",
    async () => {
      const receipt = first[0];
      const warehouseKey = JSON.stringify([
        "warehouse:warehouse-link",
        "ONE_C",
        receipt.externalWarehouseId,
      ]);
      const receiptKey = JSON.stringify([
        "warehouse:receipt",
        receipt.sourceOperationId,
      ]);
      const locked = Promise.withResolvers();
      const resume = Promise.withResolvers();
      const blocker = c.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${warehouseKey},0))`;
          const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          locked.resolve(pid);
          await resume.promise;
        },
        { timeout: 15000 },
      );
      const holder = await Promise.race([locked.promise, blocker]);
      const payload = {
        ...receipt.sourcePayload,
        lines: receipt.sourcePayload.lines.map(
          ({ id, item, quantity, order }) => ({
            id,
            item,
            quantity,
            order,
          }),
        ),
      };
      const single = c.prisma.$transaction(
        (tx) =>
          c.importer.applySnapshot(tx, a.code, payload, c.admin.id, {
            matches: new Map(),
          }),
        { timeout: 15000 },
      );
      let batch;
      try {
        await Promise.race([waitForAdvisoryLock(c.prisma, holder), single]);
        batch = service.reprocess(b.code, invoice.id);
        const [{ available }] = await c.prisma
          .$queryRaw`SELECT pg_try_advisory_xact_lock(hashtextextended(${receiptKey},0)) AS available`;
        assert.equal(
          available,
          true,
          "Receipt lock must remain free while warehouse is locked",
        );
      } finally {
        resume.resolve();
        const [, document, imported] = await Promise.all([
          blocker,
          single,
          batch,
        ]);
        assert.equal(document.id, String(receipt.id));
        assert.equal(document.conflict, null);
        assert.equal(imported?.outcome, "PROCESSED");
        assert.ok(imported.groups.every(({ status }) => status === "IMPORTED"));
      }
    },
  );
  await t.test(
    "manual mapping and invoice import acquire item identity before receipt rows",
    async (t) => {
      const locked = Promise.withResolvers();
      const resume = Promise.withResolvers();
      const lockIdentities = c.links.lockIdentities.bind(c.links);
      t.mock.method(
        c.links,
        "lockIdentities",
        async (tx, identities) => {
          await lockIdentities(tx, identities);
          const [row] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
          locked.resolve(row.pid);
          await resume.promise;
        },
        { times: 1 },
      );
      const receipt = first[0];
      const mapping = c.itemMapping.mapItem(
        String(receipt.id),
        String(receipt.lines[0].id),
        { itemId: String(c.item.id) },
        c.keeper.id,
      );
      const holder = await Promise.race([
        locked.promise,
        mapping.then(() => assert.fail("Mapping did not reach the gate")),
      ]);
      const importing = service.reprocess(b.code, invoice.id);
      try {
        await waitForAdvisoryLock(c.prisma, holder);
      } finally {
        resume.resolve();
        const [mapped, imported] = await Promise.all([mapping, importing]);
        assert.deepEqual(mapped, { itemId: String(c.item.id) });
        assert.equal(imported.outcome, "PROCESSED");
        assert.ok(imported.groups.every(({ status }) => status === "IMPORTED"));
      }
    },
  );
}
