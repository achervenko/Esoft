DROP INDEX IF EXISTS "uq_checklist_questions_active_module_sort_order";

ALTER TABLE "checklist_questions"
DROP CONSTRAINT IF EXISTS "chk_checklist_questions_sort_order_positive";

ALTER TABLE "checklist_questions"
ALTER COLUMN "checklist_module_id" DROP NOT NULL,
ALTER COLUMN "sort_order" DROP NOT NULL;

ALTER TABLE "checklist_questions"
ADD CONSTRAINT "chk_checklist_questions_module_sort_order"
CHECK (
  (
    "checklist_module_id" IS NULL
    AND "sort_order" IS NULL
  )
  OR
  (
    "checklist_module_id" IS NOT NULL
    AND "sort_order" > 0
  )
);

CREATE UNIQUE INDEX "uq_checklist_questions_active_module_sort_order"
ON "checklist_questions" ("checklist_module_id", "sort_order")
WHERE "is_active" = true
  AND "checklist_module_id" IS NOT NULL;
