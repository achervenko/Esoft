ALTER TABLE "checklist_modules"
ADD COLUMN "sort_order" INTEGER;

WITH ordered_modules AS (
  SELECT
    "id",
    row_number() OVER (ORDER BY "id" ASC) AS "sort_order"
  FROM "checklist_modules"
)
UPDATE "checklist_modules" AS module
SET "sort_order" = ordered_modules."sort_order"
FROM ordered_modules
WHERE module."id" = ordered_modules."id";

ALTER TABLE "checklist_modules"
ALTER COLUMN "sort_order" SET NOT NULL;

ALTER TABLE "checklist_modules"
ADD CONSTRAINT "chk_checklist_modules_sort_order_positive"
CHECK ("sort_order" > 0);

CREATE INDEX "idx_checklist_modules_sort_order"
ON "checklist_modules" ("sort_order");

CREATE UNIQUE INDEX "uq_checklist_modules_active_sort_order"
ON "checklist_modules" ("sort_order")
WHERE "is_active" = true;

ALTER TABLE "checklist_questions"
ADD COLUMN "sort_order" INTEGER;

WITH ordered_questions AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "checklist_module_id"
      ORDER BY "id" ASC
    ) AS "sort_order"
  FROM "checklist_questions"
)
UPDATE "checklist_questions" AS question
SET "sort_order" = ordered_questions."sort_order"
FROM ordered_questions
WHERE question."id" = ordered_questions."id";

ALTER TABLE "checklist_questions"
ALTER COLUMN "sort_order" SET NOT NULL;

ALTER TABLE "checklist_questions"
ADD CONSTRAINT "chk_checklist_questions_sort_order_positive"
CHECK ("sort_order" > 0);

CREATE INDEX "idx_checklist_questions_module_sort_order"
ON "checklist_questions" ("checklist_module_id", "sort_order");

CREATE UNIQUE INDEX "uq_checklist_questions_active_module_sort_order"
ON "checklist_questions" ("checklist_module_id", "sort_order")
WHERE "is_active" = true;
