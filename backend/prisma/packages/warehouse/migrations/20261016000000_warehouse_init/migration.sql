ALTER TYPE "audit_module" ADD VALUE 'warehouse';

-- Warehouse package depends only on core. No equipment or PPE tables are required.

CREATE TABLE "warehouse_items" (
    "id" BIGSERIAL NOT NULL,
    "article" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "comment" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "warehouse_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_warehouse_items_article" ON "warehouse_items"("article");

CREATE TABLE "warehouse_storage_locations" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "warehouse_storage_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_warehouse_storage_locations_code" ON "warehouse_storage_locations"("code");

CREATE TABLE "warehouse_projects" (
    "id" BIGSERIAL NOT NULL,
    "project_number" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "warehouse_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_warehouse_projects_project_number" ON "warehouse_projects"("project_number");

CREATE TABLE "warehouse_balances" (
    "id" BIGSERIAL NOT NULL,
    "item_id" BIGINT NOT NULL,
    "storage_location_id" BIGINT NOT NULL,
    "quantity" NUMERIC(14,3) NOT NULL DEFAULT 0,
    CONSTRAINT "fk_warehouse_balances_item" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_balances_storage_location" FOREIGN KEY ("storage_location_id") REFERENCES "warehouse_storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_warehouse_balances_quantity" CHECK ("quantity" >= 0),
    CONSTRAINT "warehouse_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_warehouse_balances_item_location" ON "warehouse_balances"("item_id", "storage_location_id");

CREATE TABLE "warehouse_project_reservations" (
    "id" BIGSERIAL NOT NULL,
    "balance_id" BIGINT NOT NULL,
    "project_id" BIGINT NOT NULL,
    "quantity" NUMERIC(14,3) NOT NULL,
    CONSTRAINT "fk_warehouse_project_reservations_balance" FOREIGN KEY ("balance_id") REFERENCES "warehouse_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_project_reservations_project" FOREIGN KEY ("project_id") REFERENCES "warehouse_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_warehouse_project_reservations_quantity" CHECK ("quantity" > 0),
    CONSTRAINT "warehouse_project_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_warehouse_project_reservations_balance_project" ON "warehouse_project_reservations"("balance_id", "project_id");

CREATE INDEX "idx_warehouse_project_reservations_project" ON "warehouse_project_reservations"("project_id");

CREATE TABLE "warehouse_issue_sheets" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "source_file_name" VARCHAR(255),
    "source_file_hash" VARCHAR(64),
    "status" VARCHAR(50) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "processed_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    CONSTRAINT "fk_warehouse_issue_sheets_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_issue_sheets_processed_by" FOREIGN KEY ("processed_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "warehouse_issue_sheets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warehouse_issue_sheet_lines" (
    "id" BIGSERIAL NOT NULL,
    "issue_sheet_id" BIGINT NOT NULL,
    "item_id" BIGINT,
    "storage_location_id" BIGINT,
    "project_id" BIGINT,
    "quantity" NUMERIC(14,3) NOT NULL,
    "unit_snapshot" VARCHAR(50),
    "source_article" VARCHAR(100),
    "source_name" VARCHAR(255),
    "source_location" VARCHAR(255),
    "source_project" VARCHAR(255),
    "matching_status" VARCHAR(50) NOT NULL,
    "error" TEXT,
    "row_number" INTEGER NOT NULL,
    CONSTRAINT "fk_warehouse_issue_sheet_lines_sheet" FOREIGN KEY ("issue_sheet_id") REFERENCES "warehouse_issue_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_issue_sheet_lines_item" FOREIGN KEY ("item_id") REFERENCES "warehouse_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_issue_sheet_lines_storage_location" FOREIGN KEY ("storage_location_id") REFERENCES "warehouse_storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_issue_sheet_lines_project" FOREIGN KEY ("project_id") REFERENCES "warehouse_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_warehouse_issue_sheet_lines_quantity" CHECK ("quantity" > 0),
    CONSTRAINT "chk_warehouse_issue_sheet_lines_row_number" CHECK ("row_number" > 0),
    CONSTRAINT "warehouse_issue_sheet_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_warehouse_issue_sheet_lines_sheet_row" ON "warehouse_issue_sheet_lines"("issue_sheet_id", "row_number");

CREATE INDEX "idx_warehouse_balances_storage_location" ON "warehouse_balances"("storage_location_id");


CREATE TABLE "warehouse_issues" (
    "id" BIGSERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "project_id" BIGINT,
    "issue_sheet_line_id" BIGINT,
    "issued_by_user_id" TEXT NOT NULL,
    "comment" TEXT,
    "override_reservations" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "warehouse_issues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_warehouse_issues_type_line" CHECK (
        ("type" = 'MANUAL' AND "issue_sheet_line_id" IS NULL)
        OR ("type" = 'ISSUE_SHEET' AND "issue_sheet_line_id" IS NOT NULL)
    ),
    CONSTRAINT "chk_warehouse_issues_override_comment" CHECK (
        "override_reservations" = false OR NULLIF(BTRIM("comment"), '') IS NOT NULL
    ),
    CONSTRAINT "fk_warehouse_issues_project" FOREIGN KEY ("project_id") REFERENCES "warehouse_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_issues_sheet_line" FOREIGN KEY ("issue_sheet_line_id") REFERENCES "warehouse_issue_sheet_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_issues_issued_by" FOREIGN KEY ("issued_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_warehouse_issues_project" ON "warehouse_issues"("project_id");
CREATE INDEX "idx_warehouse_issues_sheet_line" ON "warehouse_issues"("issue_sheet_line_id");
CREATE INDEX "idx_warehouse_issues_issued_by" ON "warehouse_issues"("issued_by_user_id");
CREATE INDEX "idx_warehouse_issues_created_at" ON "warehouse_issues"("created_at");

CREATE TABLE "warehouse_issue_positions" (
    "id" BIGSERIAL NOT NULL,
    "issue_id" BIGINT NOT NULL,
    "balance_id" BIGINT NOT NULL,
    "quantity" NUMERIC(14,3) NOT NULL,
    CONSTRAINT "warehouse_issue_positions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_warehouse_issue_positions_quantity" CHECK ("quantity" > 0),
    CONSTRAINT "fk_warehouse_issue_positions_issue" FOREIGN KEY ("issue_id") REFERENCES "warehouse_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_issue_positions_balance" FOREIGN KEY ("balance_id") REFERENCES "warehouse_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_warehouse_issue_positions_issue_balance" ON "warehouse_issue_positions"("issue_id", "balance_id");
CREATE INDEX "idx_warehouse_issue_positions_balance" ON "warehouse_issue_positions"("balance_id");


CREATE TYPE "warehouse_adjustment_type" AS ENUM ('WRITE_OFF', 'SURPLUS');
CREATE TABLE "warehouse_stock_adjustments" (
    "id" BIGSERIAL NOT NULL,
    "balance_id" BIGINT NOT NULL,
    "type" "warehouse_adjustment_type" NOT NULL,
    "quantity" NUMERIC(14,3) NOT NULL,
    "quantity_before" NUMERIC(14,3) NOT NULL,
    "quantity_after" NUMERIC(14,3) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "comment" TEXT,
    "request_key" UUID NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "warehouse_stock_adjustments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_warehouse_stock_adjustments_balance" FOREIGN KEY ("balance_id") REFERENCES "warehouse_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_stock_adjustments_user" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "chk_warehouse_stock_adjustments_quantity" CHECK ("quantity" > 0 AND "quantity_before" >= 0 AND "quantity_after" >= 0),
    CONSTRAINT "chk_warehouse_stock_adjustments_reason" CHECK (NULLIF(BTRIM("reason"), '') IS NOT NULL),
    CONSTRAINT "chk_warehouse_stock_adjustments_delta" CHECK (
      ("type" = 'WRITE_OFF' AND "quantity_after" = "quantity_before" - "quantity") OR
      ("type" = 'SURPLUS' AND "quantity_after" = "quantity_before" + "quantity")
    )
);
CREATE UNIQUE INDEX "uq_warehouse_stock_adjustments_request" ON "warehouse_stock_adjustments"("created_by_user_id", "request_key");
CREATE INDEX "idx_warehouse_stock_adjustments_balance" ON "warehouse_stock_adjustments"("balance_id", "created_at");
CREATE TABLE "warehouse_stock_adjustment_attachments" (
    "adjustment_id" BIGINT NOT NULL,
    "file_id" INTEGER NOT NULL,
    CONSTRAINT "pk_warehouse_stock_adjustment_attachments" PRIMARY KEY ("adjustment_id", "file_id"),
    CONSTRAINT "fk_warehouse_stock_adjustment_attachments_adjustment" FOREIGN KEY ("adjustment_id") REFERENCES "warehouse_stock_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_warehouse_stock_adjustment_attachments_file" FOREIGN KEY ("file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_warehouse_stock_adjustment_attachments_file" ON "warehouse_stock_adjustment_attachments"("file_id");
