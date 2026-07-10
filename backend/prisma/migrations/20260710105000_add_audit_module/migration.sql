-- CreateEnum
CREATE TYPE "audit_module" AS ENUM ('equipment');

COMMENT ON TYPE "audit_module" IS 'Модуль системы, в котором выполнено действие аудита';

-- AlterTable
ALTER TABLE "audit_log"
ADD COLUMN "module" "audit_module" NOT NULL DEFAULT 'equipment';

COMMENT ON COLUMN "audit_log"."module" IS 'Модуль системы, в котором произошло действие';

-- CreateIndex
CREATE INDEX "idx_audit_log_module" ON "audit_log"("module");
