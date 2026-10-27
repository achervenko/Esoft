import assert from "node:assert/strict";

export async function verifyIssueSheetsConcurrency(context) {
  const { service, queries, actor, create, add, issue, stockQuantity } =
    context;
  const race = await create("Гонка");
  const raceLine = await add(race, "10");
  await service.markReady(race.id, actor.id);
  const raced = await Promise.allSettled([
    issue(raceLine, "6"),
    issue(raceLine, "6"),
  ]);
  assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    raced.find((r) => r.status === "rejected").reason.response.code,
    "WAREHOUSE_ISSUE_SHEET_OVERISSUED",
  );
  assert.equal((await queries.lines(race.id, {})).items[0].issuedQuantity, "6");
  const beforeFinalizeRace = await stockQuantity();
  const finalRace = await Promise.allSettled([
    service.finalize(race.id, actor.id),
    issue(raceLine, "4"),
  ]);
  assert.equal(finalRace[0].status, "fulfilled");
  if (finalRace[1].status === "rejected") {
    assert.equal(
      finalRace[1].reason.response?.code,
      "WAREHOUSE_ISSUE_SHEET_STATE",
    );
  }
  assert.ok(
    ["PROCESSED", "PROCESSED_WITH_SHORTAGE"].includes(
      (await queries.findOne(race.id)).status,
    ),
  );
  assert.equal(
    (await queries.lines(race.id, {})).items[0].remainingQuantity,
    finalRace[1].status === "fulfilled" ? "0" : "4",
  );
  assert.ok(Number(await stockQuantity()) <= Number(beforeFinalizeRace));
}
