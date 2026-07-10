-- AlterTable
ALTER TABLE "equipment"
ADD COLUMN "issue_date" DATE;

COMMENT ON COLUMN "equipment"."issue_date" IS 'Дата выдачи оборудования ответственному';
