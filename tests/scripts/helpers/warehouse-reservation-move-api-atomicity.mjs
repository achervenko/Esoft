import assert from "node:assert/strict";

export async function verifyMoveApiAtomicity(c, t, fixture) {
  await t.test(
    "a document constraint or audit failure rolls back Stock, allocations and request key",
    async () => {
      const f = await fixture();
      const before = await f.state();
      await c.database.query(
        "ALTER TABLE warehouse_transfers ADD CONSTRAINT test_reject_reserved_move CHECK (quantity <> 3) NOT VALID",
      );
      try {
        await f.move(f.command, 500);
      } finally {
        await c.database.query(
          "ALTER TABLE warehouse_transfers DROP CONSTRAINT test_reject_reserved_move",
        );
      }
      assert.deepEqual(await f.state(), before);
      await c.database
        .query(`CREATE FUNCTION test_reject_transfer_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.entity_type = 'warehouse_transfer' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$`);
      await c.database.query(
        "CREATE TRIGGER test_reject_transfer_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION test_reject_transfer_audit()",
      );
      try {
        await f.move(f.command, 500);
      } finally {
        await c.database.query(
          "DROP TRIGGER test_reject_transfer_audit ON audit_log",
        );
        await c.database.query("DROP FUNCTION test_reject_transfer_audit()");
      }
      assert.deepEqual(await f.state(), before);
      await f.move();
      assert.equal((await f.state()).transfers, 1);
    },
  );
}
