-- CreateEnum
CREATE TYPE "storage_document_type" AS ENUM (
    'passport',
    'maintenance_instruction',
    'equipment_photo',
    'supporting_document'
);

-- Existing storage files are treated as supporting documents until users classify them.
ALTER TABLE "storage_files"
ADD COLUMN "document_type" "storage_document_type";

UPDATE "storage_files"
SET "document_type" = 'supporting_document'
WHERE "document_type" IS NULL;

ALTER TABLE "storage_files"
ALTER COLUMN "document_type" SET NOT NULL;
