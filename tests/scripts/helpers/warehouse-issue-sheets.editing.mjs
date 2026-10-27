import assert from "node:assert/strict";

export async function verifyIssueSheetsEditing(context) {
  const { service, queries, actor, create, add, issue } = context;
  const editable = await create("Неначатые строки в исполняемом листе");
  const startedLine = await add(editable, "5");
  const untouchedLine = await add(editable, "2", { rowNumber: 2 });
  await service.markReady(editable.id, actor.id);
  await issue(startedLine, "1");
  const editedLine = await service.updateLine(
    editable.id,
    untouchedLine.id,
    { quantity: "3" },
    actor.id,
  );
  assert.equal(editedLine.quantity, "3");
  assert.equal(editedLine.executionState, "NOT_STARTED");
  const appendedLine = await add(editable, "4", { rowNumber: 3 });
  assert.equal((await queries.findOne(editable.id)).status, "IN_PROGRESS");
  await service.removeLine(editable.id, untouchedLine.id, actor.id);
  const remainingLines = await queries.lines(editable.id, {});
  assert.deepEqual(
    remainingLines.items.map((row) => row.id),
    [startedLine.id, appendedLine.id],
  );
  assert.equal(remainingLines.items[0].issuedQuantity, "1");
  assert.equal(remainingLines.items[1].issuedQuantity, "0");
  assert.equal((await queries.findOne(editable.id)).status, "IN_PROGRESS");
}
