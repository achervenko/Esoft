-- Keep at most one active primary equipment photo per owner before adding the
-- database-level invariant. If old data already has duplicates, the newest
-- uploaded photo remains primary.
WITH ranked_primary_photos AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_module, owner_entity_type, owner_entity_id
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM storage_files
  WHERE is_primary = true
    AND deleted_at IS NULL
    AND document_type = 'equipment_photo'
)
UPDATE storage_files
SET is_primary = false
WHERE id IN (
  SELECT id
  FROM ranked_primary_photos
  WHERE row_number > 1
);

CREATE UNIQUE INDEX uq_storage_files_active_primary_photo
ON storage_files (
  owner_module,
  owner_entity_type,
  owner_entity_id
)
WHERE is_primary = true
  AND deleted_at IS NULL
  AND document_type = 'equipment_photo';
