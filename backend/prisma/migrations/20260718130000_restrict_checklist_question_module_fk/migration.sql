ALTER TABLE "checklist_questions"
DROP CONSTRAINT IF EXISTS "fk_checklist_questions_module";

ALTER TABLE "checklist_questions"
ADD CONSTRAINT "fk_checklist_questions_module"
FOREIGN KEY ("checklist_module_id")
REFERENCES "checklist_modules"("id")
ON DELETE RESTRICT;
