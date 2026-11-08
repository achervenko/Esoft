import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { code } from "./warehouse-issues-test-context.mjs";

export async function verifyWarehouseIssuesBasic(context) {
  const {
    prisma,
    fixture,
    payload,
    service,
    queries,
    keeper,
    denied,
    balanceQuantity,
  } = context;
  const base = await fixture(["100"]);
  assert.equal(
    (await queries.available({ itemId: String(base.item.id) })).items[0]
      .quantity,
    "100",
  );
  await assert.rejects(
    service.createIssue(payload(base, ["101"]), keeper.id),
    code("WAREHOUSE_STOCK_INSUFFICIENT"),
  );
  await assert.rejects(
    service.createIssue(payload(base, ["1"]), denied.id),
    code("FORBIDDEN"),
  );
  const manual = await service.createManualIssue(
    payload(base, ["25"]),
    keeper.id,
  );
  assert.equal(manual.type, "MANUAL");
  assert.equal(manual.issueSheetLineId, null);
  assert.equal(manual.issuedByUserId, keeper.id);
  const multi = await fixture(["100", "100"]);
  const multiIssue = await service.createIssue(
    payload(multi, ["25", "25"]),
    keeper.id,
  );
  assert.equal(multiIssue.positions.length, 2);
  assert.equal(multiIssue.totalQuantity, "50");
  for (const b of multi.balances) {
    assert.equal(await balanceQuantity(b.id), "75");
  }
  const other = await fixture();
  await assert.rejects(
    service.createIssue(
      {
        requestKey: randomUUID(),
        type: "MANUAL",
        positions: [
          { balanceId: String(multi.balances[0].id), quantity: "1" },
          { balanceId: String(other.balances[0].id), quantity: "1" },
        ],
      },
      keeper.id,
    ),
    code("WAREHOUSE_ISSUE_MULTIPLE_ITEMS"),
  );
  const unavailable = await fixture(["0"]);
  assert.equal(
    (await queries.available({ itemId: String(unavailable.item.id) })).items
      .length,
    0,
  );
  assert.equal(
    (
      await queries.available({
        itemId: String(unavailable.item.id),
        includeUnavailable: true,
      })
    ).items[0].quantity,
    "0",
  );
  assert.equal(
    (
      await queries.list({
        balanceId: String(multi.balances[0].id),
        locationId: String(multi.balances[0].storageLocationId),
        minQuantity: "25",
        maxQuantity: "25",
      })
    ).items[0].id,
    multiIssue.id,
  );
  assert.equal(
    (
      await queries.list({
        itemIds: [String(multi.item.id), String(other.item.id)],
        issuedByUserId: keeper.id,
        createdFrom: new Date(Date.now() - 60000),
        createdTo: new Date(),
        limit: 1,
      })
    ).items.length,
    1,
  );

  await prisma.user.update({
    where: { id: keeper.id },
    data: { banned: true },
  });
  await assert.rejects(
    service.createIssue(payload(other, ["1"]), keeper.id),
    code("FORBIDDEN"),
  );
}
