import assert from "node:assert/strict";

export async function verifyEvents(c, t) {
  const { accept, payload, worker, otherWorker, seen } = c;
  await t.test(
    "normalized replay, conflict and concurrent ingestion persist one event",
    async () => {
      const body = payload(),
        rows = await Promise.all(
          Array.from({ length: 12 }, () => accept(body)),
        );
      assert.equal(new Set(rows.map((e) => e.id)).size, 1);
      const reversed = await accept({
        version: body.version,
        type: body.type,
        objectId: body.objectId,
        eventId: body.eventId.toUpperCase(),
      });
      assert.equal(reversed.id, rows[0].id);
      await assert.rejects(
        accept({ ...body, version: "different" }),
        (e) => e.response?.code === "INTEGRATION_EVENT_CONFLICT",
      );
      await Promise.all([
        worker.process(BigInt(rows[0].id)),
        otherWorker.process(BigInt(rows[0].id)),
      ]);
      assert.equal(
        seen.filter((s) => s === body.objectId + ":test.first").length,
        1,
      );
    },
  );
}
