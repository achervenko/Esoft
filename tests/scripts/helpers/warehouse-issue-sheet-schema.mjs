import assert from "node:assert/strict";
export async function verifyWarehouseIssueSheetSchema({
  prisma,
  database,
  actor,
  item,
  location,
  projectRow,
}) {
  const sheet = await prisma.warehouseIssueSheet.create({
    data: {
      name: "Imported sheet",
      sourceFileName: "sheet.xlsx",
      sourceFileHash: "a".repeat(64),
      status: "draft",
      createdByUserId: actor.id,
      createdAt: new Date("2026-10-16T13:00:00+03:00"),
    },
  });
  assert.equal(sheet.processedByUserId, null);
  assert.equal(sheet.processedAt, null);
  assert.equal(sheet.createdAt.toISOString(), "2026-10-16T10:00:00.000Z");
  const line = await prisma.warehouseIssueSheetLine.create({
    data: {
      issueSheetId: sheet.id,
      quantity: "1.125",
      rowNumber: 1,
      matchingStatus: "unmatched",
      sourceArticle: "Imported article",
      sourceName: "Imported name",
      sourceLocation: "Shelf",
      sourceProject: "Project",
    },
  });
  assert.equal(line.itemId, null);
  assert.equal(line.storageLocationId, null);
  assert.equal(line.projectId, null);
  for (const rowNumber of [0, -1]) {
    await assert.rejects(
      database.query(
        "UPDATE warehouse_issue_sheet_lines SET row_number=$1 WHERE id=$2",
        [rowNumber, line.id.toString()],
      ),
      { code: "23514" },
    );
    await assert.rejects(
      database.query(
        "INSERT INTO warehouse_issue_sheet_lines(issue_sheet_id, quantity, matching_status, row_number) VALUES ($1, 1, $2, $3)",
        [sheet.id.toString(), "unmatched", rowNumber],
      ),
      { code: "23514" },
    );
  }
  await assert.rejects(
    prisma.warehouseIssueSheetLine.create({
      data: {
        issueSheetId: sheet.id,
        quantity: "2",
        rowNumber: 1,
        matchingStatus: "unmatched",
      },
    }),
    { code: "P2002" },
  );
  const secondSheet = await prisma.warehouseIssueSheet.create({
    data: {
      name: "Second sheet",
      status: "draft",
      createdByUserId: actor.id,
    },
  });
  const serverTime = await database.query("SELECT CURRENT_TIMESTAMP AS now");
  assert.ok(
    Math.abs(
      secondSheet.createdAt.getTime() - serverTime.rows[0].now.getTime(),
    ) < 10000,
  );
  const otherLine = await prisma.warehouseIssueSheetLine.create({
    data: {
      issueSheetId: secondSheet.id,
      quantity: "1",
      rowNumber: 1,
      matchingStatus: "unmatched",
    },
  });
  await assert.rejects(
    prisma.warehouseIssueSheetLine.update({
      where: { id: otherLine.id },
      data: { issueSheetId: sheet.id },
    }),
    { code: "P2002" },
  );
  await prisma.warehouseIssueSheetLine.delete({ where: { id: otherLine.id } });
  await prisma.warehouseIssueSheet.delete({ where: { id: secondSheet.id } });
  const matched = await prisma.warehouseIssueSheetLine.update({
    where: { id: line.id },
    data: {
      itemId: item.id,
      storageLocationId: location.id,
      projectId: projectRow.id,
      unitSnapshot: item.unit,
    },
    include: {
      item: true,
      storageLocation: true,
      project: true,
      issueSheet: true,
    },
  });
  assert.equal(matched.item.id, item.id);
  assert.equal(matched.unitSnapshot, "шт");
  await prisma.warehouseItem.update({
    where: { id: item.id },
    data: { unit: "уп" },
  });
  assert.equal(
    (
      await prisma.warehouseIssueSheetLine.findUniqueOrThrow({
        where: { id: line.id },
      })
    ).unitSnapshot,
    "шт",
  );
  assert.equal(matched.issueSheet.id, sheet.id);
  await prisma.warehouseIssueSheet.update({
    where: { id: sheet.id },
    data: {
      processedByUserId: actor.id,
      processedAt: new Date("2026-10-16T11:00:00Z"),
    },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    include: {
      createdWarehouseIssueSheets: true,
      processedWarehouseIssueSheets: true,
    },
  });
  assert.equal(user.createdWarehouseIssueSheets[0].id, sheet.id);
  assert.equal(user.processedWarehouseIssueSheets[0].id, sheet.id);
  await assert.rejects(
    prisma.warehouseIssueSheet.update({
      where: { id: sheet.id },
      data: { processedByUserId: "missing-user" },
    }),
    { code: "P2003" },
  );
  await assert.rejects(prisma.user.delete({ where: { id: actor.id } }), {
    code: "P2003",
  });
  await assert.rejects(
    prisma.warehouseItem.delete({ where: { id: item.id } }),
    { code: "P2003" },
  );
  await assert.rejects(
    prisma.warehouseIssueSheet.delete({ where: { id: sheet.id } }),
    { code: "P2003" },
  );
  return { sheet, line };
}
