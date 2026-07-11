-- CreateEnum
CREATE TYPE "storage_owner_module" AS ENUM ('equipment');

-- Drop old equipment-only file binding.
DROP TABLE IF EXISTS "equipment_attachments";

-- Make storage file ownership universal.
ALTER TABLE "storage_files"
ADD COLUMN "owner_module" "storage_owner_module" NOT NULL,
ADD COLUMN "owner_entity_type" VARCHAR(64) NOT NULL,
ADD COLUMN "owner_entity_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "idx_storage_files_owner"
ON "storage_files"("owner_module", "owner_entity_type", "owner_entity_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_storage_files_owner_entity_id"
ON "storage_files"("owner_entity_id");
