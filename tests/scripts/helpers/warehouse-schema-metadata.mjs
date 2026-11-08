import assert from "node:assert/strict";
export async function verifyWarehouseSchemaMetadata({ database }) {
  const reservationForeignKeys = await database.query(`
    SELECT fk.conrelid::regclass::text AS source_table,
           source_column.attname AS source_column,
           fk.confrelid::regclass::text AS target_table,
           target_column.attname AS target_column,
           fk.confdeltype AS delete_action,
           fk.confupdtype AS update_action
    FROM pg_constraint fk
    JOIN pg_attribute source_column
      ON source_column.attrelid = fk.conrelid
     AND source_column.attnum = fk.conkey[1]
    JOIN pg_attribute target_column
      ON target_column.attrelid = fk.confrelid
     AND target_column.attnum = fk.confkey[1]
    WHERE fk.contype = 'f'
      AND cardinality(fk.conkey) = 1
      AND fk.conrelid IN (
        'public.warehouse_reservations'::regclass,
        'public.warehouse_reservation_allocations'::regclass
      )
      AND fk.confrelid IN (
        'public.customer_orders'::regclass,
        'public.warehouse_items'::regclass,
        'public.warehouse_reservations'::regclass,
        'public.warehouse_storage_locations'::regclass
      )
    ORDER BY source_table, source_column
  `);
  assert.deepEqual(
    reservationForeignKeys.rows,
    [
      [
        "warehouse_reservation_allocations",
        "location_id",
        "warehouse_storage_locations",
      ],
      [
        "warehouse_reservation_allocations",
        "reservation_id",
        "warehouse_reservations",
      ],
      ["warehouse_reservations", "item_id", "warehouse_items"],
      ["warehouse_reservations", "order_id", "customer_orders"],
    ].map(([source_table, source_column, target_table]) => ({
      source_table,
      source_column,
      target_table,
      target_column: "id",
      delete_action: "r",
      update_action: "c",
    })),
  );
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
      "warehouse_receipt_placements",
      "warehouse_item_external_links",
      "warehouse_external_warehouses",
      "warehouse_items",
      "warehouse_storage_locations",
      "warehouse_balances",
      "warehouse_issue_sheets",
      "warehouse_issue_sheet_lines",
      "warehouse_issues",
      "warehouse_issue_requests",
      "warehouse_issue_positions",
      "warehouse_stock_adjustments",
      "warehouse_stock_adjustment_attachments",
      "warehouse_stock_adjustment_noops",
      "warehouse_reservations",
      "warehouse_reservation_allocations",
    ].sort(),
  );
  assert.equal(
    columns.some(
      (column) =>
        ["project_id", "source_project", "override_reservations"].includes(
          column.column_name,
        ) ||
        (column.column_name === "order_id" &&
          column.table_name !== "warehouse_reservations"),
    ),
    false,
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
  assert.equal(
    columns.some((column) => column.column_name === "webhook_token_hash"),
    false,
  );
  assert.equal(
    (
      await database.query(
        "SELECT to_regclass('public.api_key') IS NOT NULL AS present",
      )
    ).rows[0].present,
    true,
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
    assert.equal(
      column.data_type,
      ["warehouse_reservations", "warehouse_reservation_allocations"].includes(
        column.table_name,
      )
        ? "uuid"
        : "bigint",
    );
}
