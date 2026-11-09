import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyReceiptOrderAtomicity(c, t, { make }) {
  await t.test(
    "document and all audit failures roll back physical receipt and reservation together",
    async () => {
      for (const [name, table, filter] of [
        ["placement", "warehouse_receipt_placements", "true"],
        ["stock", "audit_log", "NEW.entity_type = 'warehouse_balance'"],
        [
          "reservation",
          "audit_log",
          "NEW.entity_type = 'warehouse_reservation'",
        ],
        ["receipt", "audit_log", "NEW.entity_type = 'warehouse_receipt'"],
      ]) {
        const f = await make();
        const receipt = await f.create("2");
        const before = await f.state();
        await c.database
          .query(`CREATE FUNCTION reject_order_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF ${filter} THEN RAISE EXCEPTION 'receipt test failure'; END IF; RETURN NEW; END $$`);
        await c.database.query(
          `CREATE TRIGGER reject_order_receipt BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_order_receipt()`,
        );
        const key = randomUUID();
        try {
          await f.place(receipt, "2", undefined, c.a, key, 500);
        } finally {
          await c.database.query(
            `DROP TRIGGER reject_order_receipt ON ${table}`,
          );
          await c.database.query("DROP FUNCTION reject_order_receipt()");
        }
        assert.deepEqual(await f.state(), before, name);
        await f.place(receipt, "2", undefined, c.a, key);
        await f.assertAmounts("2", "2", "0");
      }
    },
  );

  await t.test(
    "overflow in the second half of a combined distribution rolls back its restored half",
    async () => {
      const f = await make();
      await f.seed("99999999999.999", "2");
      await c.issue(c.a, "2", f.itemId);
      const receipt = await f.create("2");
      const before = await f.state();
      const failed = await f.place(
        receipt,
        "2",
        { restoreQuantity: "1", increaseQuantity: "1" },
        c.a,
        randomUUID(),
        409,
      );
      assert.equal(failed.code, "WAREHOUSE_RESERVATION_OVERFLOW");
      assert.deepEqual(await f.state(), before);
      const success = await f.place(receipt, "2", {
        restoreQuantity: "2",
        increaseQuantity: "0",
      });
      assert.equal(success.reservation.deficitQuantity, "0");
    },
  );

  await t.test(
    "positive arrivals permit stock mismatch while impossible order coverage rolls back completely",
    async () => {
      const f = await make();
      await f.seed("10", "0");
      await c.transaction(({ tx }) => c.forceBalance(tx, c.a, "8", f.itemId));
      const receipt = await f.create("5");
      const before = await f.state();
      const error = await f.place(
        receipt,
        "5",
        undefined,
        c.a,
        randomUUID(),
        409,
      );
      assert.equal(error.code, "WAREHOUSE_RESERVATION_INSUFFICIENT");
      assert.deepEqual(await f.state(), before);
      await f.place(await f.create("5", null), "5");
      assert.equal((await c.read(c.a, f.itemId)).quantity, "13");
      await f.assertAmounts("10", "10", "0");
    },
  );
}
