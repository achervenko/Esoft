import assert from "node:assert/strict";
import { code } from "./warehouse-issue-sheets-test-context.mjs";

export async function verifyIssueSheetsQuery(context) {
  const {
    prisma,
    service,
    queries,
    actor,
    item,
    location,
    project,
    create,
    add,
    issue,
  } = context;
  const sheet = await create("100%_Лист");
  const foreignWarehouse = await prisma.warehouse.create({
    data: { name: "Другой склад" },
  });
  const foreignSheet = await service.create(
    { warehouseId: String(foreignWarehouse.id), name: "Чужой лист" },
    actor.id,
  );
  const localResult = await queries.list({
    warehouseId: String(location.warehouseId),
  });
  assert.equal(
    localResult.items.some((row) => row.id === sheet.id),
    true,
  );
  assert.equal(
    localResult.items.some((row) => row.id === foreignSheet.id),
    false,
  );
  const foreignResult = await queries.list({
    warehouseId: String(foreignWarehouse.id),
  });
  assert.equal(foreignResult.total, 1);
  assert.deepEqual(
    foreignResult.items.map((row) => row.id),
    [foreignSheet.id],
  );
  const line = await add(sheet);
  await service.markReady(sheet.id, actor.id);
  await issue(line, "15");
  await service.finalize(sheet.id, actor.id);
  const complete = await create("Полный");
  const completeLine = await add(complete, "2.125");
  await service.markReady(complete.id, actor.id);
  await issue(completeLine, "2.125");
  await service.finalize(complete.id, actor.id);
  const unmatched = await create("Ошибки");
  await add(unmatched, "3", {
    itemId: null,
    matchingStatus: "ERROR",
    error: "Не найдено",
  });
  await assert.rejects(
    service.markReady(unmatched.id, actor.id),
    code("WAREHOUSE_ISSUE_SHEET_NOT_READY"),
  );
  assert.equal(
    (
      await queries.lines(unmatched.id, {
        matchingStatuses: "ERROR",
        hasError: "true",
        rowFrom: "1",
        rowTo: "1",
      })
    ).total,
    1,
  );
  assert.equal(
    (
      await queries.list({
        warehouseId: String(location.warehouseId),
        hasErrors: true,
        hasUnmatchedLines: true,
      })
    ).items[0].id,
    unmatched.id,
  );
  assert.equal(
    (
      await queries.list({
        warehouseId: String(location.warehouseId),
        search: "100%_",
      })
    ).items[0].id,
    sheet.id,
  );
  assert.equal(
    (
      await queries.list({
        warehouseId: String(location.warehouseId),
        statuses: ["PROCESSED"],
        hasShortage: false,
        itemId: String(item.id),
        projectId: String(project.id),
        processedByUserId: actor.id,
      })
    ).total,
    1,
  );
  assert.equal(
    (
      await queries.list({
        warehouseId: String(location.warehouseId),
        sourceFileHash: "a".repeat(64),
        createdByUserId: actor.id,
        limit: 1,
        page: 2,
      })
    ).items.length,
    1,
  );
  const now = new Date();
  assert.ok(
    (
      await queries.list({
        warehouseId: String(location.warehouseId),
        createdFrom: new Date(now.getTime() - 60000),
        createdTo: now,
        sortBy: "name",
        sortOrder: "asc",
      })
    ).total > 0,
  );
}
