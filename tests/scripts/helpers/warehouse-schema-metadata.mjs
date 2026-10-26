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
  const columns = (
    await database.query(
      "SELECT table_name,column_name,data_type,numeric_precision,numeric_scale,character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'warehouse_%'",
    )
  ).rows;
  assert.deepEqual(
    [...new Set(columns.map((column) => column.table_name))].sort(),
    [
      "warehouse_items",
      "warehouse_storage_locations",
      "warehouse_projects",
      "warehouse_balances",
      "warehouse_project_reservations",
      "warehouse_issue_sheets",
      "warehouse_issue_sheet_lines",
      "warehouse_issues",
      "warehouse_issue_positions",
      "warehouse_stock_adjustments",
      "warehouse_stock_adjustment_attachments",
    ].sort(),
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
