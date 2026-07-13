ALTER TABLE "storage_files"
    ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;

WITH ranked_photos AS (
    SELECT
        "id",
        row_number() OVER (
            PARTITION BY "owner_module", "owner_entity_type", "owner_entity_id", "document_type"
            ORDER BY "created_at" DESC, "id" DESC
        ) AS row_number
    FROM "storage_files"
    WHERE "deleted_at" IS NULL
      AND "document_type" = 'equipment_photo'
)
UPDATE "storage_files" sf
SET "is_primary" = true
FROM ranked_photos rp
WHERE sf."id" = rp."id"
  AND rp.row_number = 1;

CREATE INDEX "idx_storage_files_primary"
    ON "storage_files"("owner_module", "owner_entity_type", "owner_entity_id", "document_type", "is_primary");
