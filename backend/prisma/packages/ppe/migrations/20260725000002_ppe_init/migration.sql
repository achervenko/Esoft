

-- PPE-owned attributes live separately so core Employee scalar queries never require PPE.
CREATE TABLE "ppe_employee_sizes" (
    "employee_id" INTEGER NOT NULL,
    "clothing_size" VARCHAR(20),
    "clothing_height" VARCHAR(20),
    "shoe_size" NUMERIC(3,1),
    "glove_size" VARCHAR(20),
    "headwear_size" VARCHAR(20),

    CONSTRAINT "ppe_employee_sizes_pkey" PRIMARY KEY ("employee_id"),
    CONSTRAINT "chk_employees_shoe_size" CHECK ("shoe_size" IS NULL OR "shoe_size" BETWEEN 15 AND 60),
    CONSTRAINT "fk_ppe_employee_sizes_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE
);


-- CreateEnum
CREATE TYPE "ppe_period_unit" AS ENUM ('DAY', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "ppe_issue_status" AS ENUM ('ISSUED', 'CANCELLED');
CREATE TYPE "ppe_issue_type" AS ENUM ('REGULAR', 'EXTRA');
CREATE TYPE "ppe_item_type" AS ENUM ('OTHER', 'BODY', 'FEET', 'HANDS', 'HEAD');

-- CreateTable
CREATE TABLE "ppe_items" (
    "type" "ppe_item_type" NOT NULL,
    "id" SERIAL NOT NULL,
    "article" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ppe_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_ppe_items_article" UNIQUE ("article"),
    CONSTRAINT "ck_ppe_items_unit" CHECK ("unit" IN ('шт', 'пары', 'мл'))
);

-- CreateTable
CREATE TABLE "ppe_norms" (
    "id" SERIAL NOT NULL,
    "position_id" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "transition_mode" TEXT NOT NULL DEFAULT 'SOFT',
    "previous_norm_id" INTEGER,

    CONSTRAINT "ppe_norms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ck_ppe_norm_transition_mode" CHECK ("transition_mode" IN ('SOFT', 'HARD')),
    CONSTRAINT "chk_ppe_norms_effective_period" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from")
);

-- CreateTable
CREATE TABLE "ppe_norm_items" (
    "ppe_name_snapshot" TEXT NOT NULL,
    "ppe_unit_snapshot" TEXT NOT NULL,
    "ppe_item_type_snapshot" "ppe_item_type" NOT NULL,
    "id" SERIAL NOT NULL,
    "norm_id" INTEGER NOT NULL,
    "ppe_item_id" INTEGER NOT NULL,
    "quantity" NUMERIC(12,3) NOT NULL,
    "period_count" INTEGER NOT NULL,
    "period_unit" "ppe_period_unit" NOT NULL,

    CONSTRAINT "ppe_norm_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uq_ppe_norm_items_norm_ppe_item" UNIQUE ("norm_id", "ppe_item_id"),
    CONSTRAINT "chk_ppe_norm_items_quantity" CHECK ("quantity" > 0 AND "quantity" <> 'NaN'::numeric),
    CONSTRAINT "chk_ppe_norm_items_period_count" CHECK ("period_count" > 0)
);

-- CreateTable
CREATE TABLE "ppe_item_sizes" (
    "id" SERIAL NOT NULL,
    "ppe_item_id" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ppe_item_sizes_pkey" PRIMARY KEY ("id"),
    "height_value" TEXT,
    CONSTRAINT "uq_ppe_item_sizes_item_value" UNIQUE NULLS NOT DISTINCT ("ppe_item_id", "value", "height_value"),
    CONSTRAINT "chk_ppe_item_sizes_value" CHECK ("value" = btrim("value") AND "value" <> ''),
    CONSTRAINT "chk_ppe_item_sizes_height" CHECK ("height_value" IS NULL OR ("height_value" = btrim("height_value") AND "height_value" <> ''))
);

-- CreateTable
CREATE TABLE "ppe_issues" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "employee_name_snapshot" TEXT NOT NULL,
    "position_id" INTEGER NOT NULL,
    "position_name_snapshot" VARCHAR(64) NOT NULL,
    "issue_type" "ppe_issue_type" NOT NULL,
    "norm_item_id" INTEGER,
    "norm_item_ppe_item_id" INTEGER,
    "norm_ppe_article_snapshot" TEXT,
    "norm_ppe_name_snapshot" TEXT,
    "ppe_item_id" INTEGER NOT NULL,
    "ppe_item_type_snapshot" "ppe_item_type" NOT NULL,
    "ppe_article_snapshot" TEXT NOT NULL,
    "ppe_name_snapshot" TEXT NOT NULL,
    "ppe_unit_snapshot" TEXT NOT NULL,
    "quantity" NUMERIC(12,3) NOT NULL,
    "size_value" TEXT,
    "clothing_height_snapshot" TEXT,
    "scheduled_at" DATE,
    "issued_at" DATE NOT NULL,
    "issued_by_user_id" TEXT NOT NULL,
    "issued_by_name_snapshot" TEXT NOT NULL,
    "status" "ppe_issue_status" NOT NULL DEFAULT 'ISSUED',
    "comment" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" TEXT,
    "cancelled_by_name_snapshot" TEXT,
    "cancellation_reason" TEXT,
    CONSTRAINT "ppe_issues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_ppe_issues_quantity" CHECK ("quantity" > 0 AND "quantity" <> 'NaN'::numeric),
    CONSTRAINT "chk_ppe_issues_type" CHECK (
      ("issue_type" = 'REGULAR' AND "norm_item_id" IS NOT NULL AND "norm_item_ppe_item_id" IS NOT NULL
        AND "norm_ppe_article_snapshot" IS NOT NULL AND "norm_ppe_name_snapshot" IS NOT NULL
        AND "scheduled_at" IS NOT NULL)
      OR ("issue_type" = 'EXTRA' AND "norm_item_id" IS NULL AND "norm_item_ppe_item_id" IS NULL
        AND "norm_ppe_article_snapshot" IS NULL AND "norm_ppe_name_snapshot" IS NULL AND "scheduled_at" IS NULL)
    ),
    CONSTRAINT "chk_ppe_issues_cancellation" CHECK (
      ("status" = 'ISSUED' AND "cancelled_at" IS NULL AND "cancelled_by_user_id" IS NULL AND "cancelled_by_name_snapshot" IS NULL AND "cancellation_reason" IS NULL)
      OR ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL AND "cancelled_by_name_snapshot" IS NOT NULL
        AND "cancellation_reason" IS NOT NULL AND "cancellation_reason" = btrim("cancellation_reason") AND "cancellation_reason" <> '')
    )
);

-- CreateIndex
CREATE INDEX "idx_ppe_norms_position_effective_from" ON "ppe_norms"("position_id", "effective_from");

-- CreateIndex
CREATE INDEX "idx_ppe_norm_previous" ON "ppe_norms"("previous_norm_id");

-- CreateIndex
CREATE INDEX "idx_ppe_norm_items_norm_id" ON "ppe_norm_items"("norm_id");

-- CreateIndex
CREATE INDEX "idx_ppe_norm_items_ppe_item_id" ON "ppe_norm_items"("ppe_item_id");

-- CreateIndex
CREATE INDEX "idx_ppe_issues_norm_item_issued_at" ON "ppe_issues"("norm_item_id", "issued_at");

-- CreateIndex
CREATE INDEX "idx_ppe_issues_ppe_item_id" ON "ppe_issues"("ppe_item_id");

-- CreateIndex
CREATE INDEX "idx_ppe_issues_position_id" ON "ppe_issues"("position_id");

-- CreateIndex
CREATE INDEX "idx_ppe_issues_issued_by_user_id" ON "ppe_issues"("issued_by_user_id");

-- AddForeignKey
ALTER TABLE "ppe_norms" ADD CONSTRAINT "fk_ppe_norms_position" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_norms" ADD CONSTRAINT "ppe_norms_previous_norm_id_fkey" FOREIGN KEY ("previous_norm_id") REFERENCES "ppe_norms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_norm_items" ADD CONSTRAINT "fk_ppe_norm_items_norm" FOREIGN KEY ("norm_id") REFERENCES "ppe_norms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_norm_items" ADD CONSTRAINT "fk_ppe_norm_items_ppe_item" FOREIGN KEY ("ppe_item_id") REFERENCES "ppe_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_item_sizes" ADD CONSTRAINT "fk_ppe_item_sizes_ppe_item" FOREIGN KEY ("ppe_item_id") REFERENCES "ppe_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_issues" ADD CONSTRAINT "fk_ppe_issues_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_issues" ADD CONSTRAINT "fk_ppe_issues_position" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_issues" ADD CONSTRAINT "fk_ppe_issues_norm_item" FOREIGN KEY ("norm_item_id") REFERENCES "ppe_norm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_issues" ADD CONSTRAINT "fk_ppe_issues_ppe_item" FOREIGN KEY ("ppe_item_id") REFERENCES "ppe_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ppe_issues" ADD CONSTRAINT "fk_ppe_issues_issued_by_user" FOREIGN KEY ("issued_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_ppe_issues_cancelled_by_user_id" ON "ppe_issues"("cancelled_by_user_id");
CREATE INDEX "idx_ppe_issues_norm_ppe_item_id" ON "ppe_issues"("norm_item_ppe_item_id");
CREATE UNIQUE INDEX "uq_ppe_issues_regular_obligation" ON "ppe_issues"("employee_id", "norm_item_id", "scheduled_at") WHERE "issue_type" = 'REGULAR' AND "status" = 'ISSUED';
ALTER TABLE "ppe_issues" ADD CONSTRAINT "fk_ppe_issues_norm_ppe_item" FOREIGN KEY ("norm_item_ppe_item_id") REFERENCES "ppe_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ppe_issues" ADD CONSTRAINT "fk_ppe_issues_cancelled_by_user" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX idx_search_ppe_name_trgm ON ppe_items USING gin (app_search_normalize(name) gin_trgm_ops) WHERE is_active = true;
CREATE INDEX idx_search_ppe_article_trgm ON ppe_items USING gin (app_search_normalize(article) gin_trgm_ops) WHERE is_active = true;
CREATE INDEX idx_search_ppe_text_trgm ON ppe_items USING gin (app_search_normalize(article || ' ' || name) gin_trgm_ops) WHERE is_active = true;

CREATE INDEX idx_ppe_journal_date ON ppe_issues (issued_at DESC, id DESC);
CREATE INDEX idx_ppe_journal_employee_page ON ppe_issues (employee_id, issued_at DESC, id DESC);

-- All concat_ws arguments are text; the date is formatted without locale or
-- timezone dependent functions. The result is immutable for these argument types.
CREATE OR REPLACE FUNCTION public.app_ppe_journal_search_text(
  employee_name text, position_name text, item_name text, article text,
  norm_name text, norm_article text, issuer_name text, issue_comment text,
  size text, height text, issue_day date,
  issue_status ppe_issue_status, issue_kind ppe_issue_type
) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT public.app_search_normalize(concat_ws(' ', employee_name, position_name,
    item_name, article, norm_name, norm_article, issuer_name, issue_comment,
    coalesce(nullif(concat_ws('; ', nullif(size, ''), nullif(height, '')), ''), 'Без размера'),
    lpad(extract(day from issue_day)::int::text, 2, '0') || '.' ||
    lpad(extract(month from issue_day)::int::text, 2, '0') || '.' || lpad(extract(year from issue_day)::int::text, 4, '0'),
    CASE issue_status WHEN 'ISSUED' THEN 'Выдано' ELSE 'Отменено' END,
    CASE issue_kind WHEN 'REGULAR' THEN 'Нормативная' ELSE 'Дополнительная' END))
$$;


ALTER TABLE ppe_issues ADD COLUMN journal_search_text text GENERATED ALWAYS AS (
  public.app_ppe_journal_search_text(employee_name_snapshot, position_name_snapshot,
    ppe_name_snapshot, ppe_article_snapshot, norm_ppe_name_snapshot,
    norm_ppe_article_snapshot, issued_by_name_snapshot, comment, size_value,
    clothing_height_snapshot, issued_at, status, issue_type)
) STORED;


CREATE INDEX idx_ppe_journal_search_trgm ON ppe_issues USING gin (journal_search_text gin_trgm_ops);
