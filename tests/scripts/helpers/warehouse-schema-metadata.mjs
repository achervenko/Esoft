import assert from "node:assert/strict";
export async function verifyWarehouseSchemaMetadata({ database }) {
  const index = await database.query(
    "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='idx_warehouse_project_reservations_project'",
  );
  assert.match(index.rows[0].indexdef, /\(project_id\)/);
  const locationIndex = await database.query(
    "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='idx_warehouse_balances_storage_location'",
  );
  assert.match(locationIndex.rows[0].indexdef, /\(storage_location_id\)/);
  const transferRequestIndex = await database.query(
    "SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='uq_warehouse_transfers_request'",
  );
  assert.match(
    transferRequestIndex.rows[0].indexdef,
    /UNIQUE.*\(created_by_user_id, request_key\)/,
  );
  const historyIndexes = await database.query(
    "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_warehouse_issues_history_search','idx_warehouse_issues_warehouse_created')",
  );
  assert.equal(historyIndexes.rows.length, 2);
  assert.match(
    historyIndexes.rows.find(
      (row) => row.indexname === "idx_warehouse_issues_history_search",
    ).indexdef,
    /USING gin \(search_text gin_trgm_ops\)/,
  );
  assert.match(
    historyIndexes.rows.find(
      (row) => row.indexname === "idx_warehouse_issues_warehouse_created",
    ).indexdef,
    /\(warehouse_id, created_at, id\)/,
  );
  const columns = (
    await database.query(
      "SELECT table_name,column_name,data_type,numeric_precision,numeric_scale,character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND (table_name LIKE 'warehouse_%' OR table_name = 'warehouses')",
    )
  ).rows;
  assert.deepEqual(
    [...new Set(columns.map((column) => column.table_name))].sort(),
    [
      "warehouses",
      "warehouse_receipts",
      "warehouse_transfers",
      "warehouse_receipt_lines",
      "warehouse_items",
      "warehouse_storage_locations",
      "warehouse_projects",
      "warehouse_balances",
      "warehouse_project_reservations",
      "warehouse_issue_sheets",
      "warehouse_issue_sheet_lines",
      "warehouse_issues",
      "warehouse_issue_requests",
      "warehouse_issue_positions",
      "warehouse_stock_adjustments",
      "warehouse_stock_adjustment_attachments",
    ].sort(),
  );
  assert.equal(
    columns.some(
      (column) =>
        ["warehouses", "warehouse_storage_locations"].includes(
          column.table_name,
        ) && column.column_name === "code",
    ),
    false,
  );
  assert.equal(
    columns.some((column) =>
      ["warehouse_code_snapshot", "storage_location_code_snapshot"].includes(
        column.column_name,
      ),
    ),
    false,
  );
  const names = await database.query(
    "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('uq_warehouses_name','uq_warehouse_storage_locations_warehouse_name')",
  );
  assert.equal(names.rows.length, 2);
  assert.match(
    names.rows.find((row) => row.indexname === "uq_warehouses_name").indexdef,
    /UNIQUE.*\(name\)/,
  );
  assert.match(
    names.rows.find(
      (row) =>
        row.indexname === "uq_warehouse_storage_locations_warehouse_name",
    ).indexdef,
    /UNIQUE.*\(warehouse_id, name\)/,
  );
  for (const column of columns.filter(
    (column) => column.column_name === "quantity",
  )) {
    assert.equal(column.numeric_precision, 14);
    assert.equal(column.numeric_scale, 3);
  }
  assert.equal(
    columns.find(
      (column) =>
        column.table_name === "warehouse_issue_sheets" &&
        column.column_name === "created_at",
    ).data_type,
    "timestamp with time zone",
  );
  assert.equal(
    columns.find(
      (column) =>
        column.table_name === "warehouse_issue_sheets" &&
        column.column_name === "source_file_hash",
    ).character_maximum_length,
    64,
  );
  for (const column of columns.filter((column) => column.column_name === "id"))
    assert.equal(column.data_type, "bigint");
}
