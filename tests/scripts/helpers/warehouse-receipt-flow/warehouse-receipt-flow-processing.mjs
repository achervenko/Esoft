import assert from "node:assert/strict";
export async function verifyReceiptProcessing(context) {
  const { prisma, warehouse, source, events, worker, key } = context;
  const delivery = { objectId: context.document.id };
  const accepted = await events.accept(
    source.code,
    "warehouse.receipts",
    delivery,
    `Bearer ${key.key}`,
  );
  await worker.process(BigInt(accepted.id));
  assert.equal(
    (
      await prisma.integrationEvent.findUniqueOrThrow({
        where: { id: BigInt(accepted.id) },
      })
    ).status,
    "PROCESSED",
  );
  const receipt = await prisma.warehouseReceipt.findFirstOrThrow({
    where: {
      sourceSystem: source.code,
      sourceOperationId: context.document.id,
    },
  });
  assert.equal(receipt.createdByUserId, source.actorUserId);
  assert.equal(await warehouse.quantity(), "0");
  assert.equal(receipt.warehouseId, warehouse.warehouse.id);
  const card = await warehouse.receipts.findOne(String(receipt.id));
  await warehouse.itemMapping.mapItem(
    card.id,
    card.lines[0].id,
    { itemId: String(warehouse.item.id) },
    warehouse.keeper.id,
  );
  await warehouse.placements.place(
    card.id,
    card.lines[0].id,
    warehouse.placement("10"),
    warehouse.keeper.id,
  );
  assert.equal(await warehouse.quantity(), "10");
  const unchangedReceivedAt = new Date("2020-01-01T00:00:00Z");
  await prisma.warehouseReceipt.update({
    where: { id: receipt.id },
    data: { receivedAt: unchangedReceivedAt },
  });
  // A notification may concern fields outside the receipt contract, such as 1C prices.
  // Its GET then returns the same relevant document, including equivalent decimals.
  context.document = {
    ...context.document,
    lines: context.document.lines.map((line) => ({
      ...line,
      quantity: "10.000",
    })),
  };
  const repeat = await events.accept(
    source.code,
    "warehouse.receipts",
    delivery,
    `Bearer ${key.key}`,
  );
  await worker.process(BigInt(repeat.id));
  assert.equal(await warehouse.quantity(), "10");
  assert.equal(context.calls, 2);
  const unchanged = await warehouse.receipts.findOne(String(receipt.id));
  assert.equal(unchanged.receivedAt, unchangedReceivedAt.toISOString());
  assert.equal(unchanged.sourceVersion, "1");
  const summary = await warehouse.queries.list({
    warehouseId: String(warehouse.warehouse.id),
    status: "PLACED",
    sortBy: "receivedAt",
  });
  assert.equal(
    summary.items.find((row) => row.id === String(receipt.id)).receivedAt,
    unchangedReceivedAt.toISOString(),
  );
  const parallel = await Promise.all([
    events.accept(
      source.code,
      "warehouse.receipts",
      delivery,
      `Bearer ${key.key}`,
    ),
    events.accept(
      source.code,
      "warehouse.receipts",
      delivery,
      `Bearer ${key.key}`,
    ),
  ]);
  assert.notEqual(parallel[0].eventId, parallel[1].eventId);
  await Promise.all(parallel.map((entry) => worker.process(BigInt(entry.id))));
  for (const entry of parallel)
    assert.equal(
      (
        await prisma.integrationEvent.findUniqueOrThrow({
          where: { id: BigInt(entry.id) },
        })
      ).status,
      "PROCESSED",
    );
  assert.equal(
    (
      await prisma.warehouseReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
      })
    ).sourceVersion,
    1n,
  );
  assert.equal(await warehouse.quantity(), "10");
  assert.equal(
    (await warehouse.receipts.findOne(String(receipt.id))).receivedAt,
    unchangedReceivedAt.toISOString(),
  );
  context.document = {
    ...context.document,
    number: context.document.number + "-исправлен",
  };
  const newer = await events.accept(
    source.code,
    "warehouse.receipts",
    delivery,
    `Bearer ${key.key}`,
  );
  await worker.process(BigInt(newer.id));
  assert.equal(
    (
      await prisma.warehouseReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
      })
    ).sourceVersion,
    2n,
  );
  assert.ok(
    new Date(
      (await warehouse.receipts.findOne(String(receipt.id))).receivedAt,
    ) > unchangedReceivedAt,
  );
  context.document = { ...context.document, status: "CANCELLED" };
  const cancellation = await events.accept(
    source.code,
    "warehouse.receipts",
    delivery,
    `Bearer ${key.key}`,
  );
  await worker.process(BigInt(cancellation.id));
  let cancelled = await prisma.warehouseReceipt.findUniqueOrThrow({
    where: { id: receipt.id },
  });
  assert.equal(cancelled.conflict, "SOURCE_CANCELLED_AFTER_PLACEMENT");
  assert.equal(cancelled.sourceVersion, 3n);
  await warehouse.conflictResolution.resolve(
    String(receipt.id),
    {
      action: "KEEP_CURRENT",
      reason: "Факт подтверждён администратором",
      sourceVersion: "3",
    },
    context.admin.id,
  );
  const replayDecision = await events.accept(
    source.code,
    "warehouse.receipts",
    delivery,
    `Bearer ${key.key}`,
  );
  await worker.process(BigInt(replayDecision.id));
  cancelled = await prisma.warehouseReceipt.findUniqueOrThrow({
    where: { id: receipt.id },
  });
  assert.equal(cancelled.conflict, null);
  assert.equal(cancelled.sourceVersion, 3n);
  assert.equal(cancelled.status, "PLACED");
  assert.equal(await warehouse.quantity(), "10");
  const grant = await prisma.systemActorPermission.findMany({
    where: { actorUserId: source.actorUserId },
  });
  assert.deepEqual(
    grant.map((g) => g.permission),
    ["warehouse.receipts.integration"],
  );
  return { receipt, delivery };
}
