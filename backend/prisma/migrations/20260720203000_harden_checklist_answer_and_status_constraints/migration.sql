BEGIN;

UPDATE checklists
SET
  checklist_date = COALESCE(checklist_date, completed_at::date)
WHERE status = 'COMPLETED'
  AND completed_at IS NOT NULL
  AND checklist_date IS NULL;

DO $$
DECLARE
  invalid_answer_metadata_count integer;
  invalid_checklist_lifecycle_count integer;
BEGIN
  SELECT COUNT(*)
  INTO invalid_answer_metadata_count
  FROM checklist_details
  WHERE NOT (
    (
      answer_boolean IS NULL
      AND answer_integer IS NULL
      AND answer_decimal IS NULL
      AND answer_text IS NULL
      AND answer_date IS NULL
      AND answered_at IS NULL
      AND answered_by IS NULL
    )
    OR
    (
      (
        answer_boolean IS NOT NULL
        OR answer_integer IS NOT NULL
        OR answer_decimal IS NOT NULL
        OR answer_text IS NOT NULL
        OR answer_date IS NOT NULL
      )
      AND answered_at IS NOT NULL
      AND answered_by IS NOT NULL
    )
  );

  IF invalid_answer_metadata_count > 0 THEN
    RAISE EXCEPTION
      'checklist_details contains % rows with inconsistent answer metadata',
      invalid_answer_metadata_count;
  END IF;

  SELECT COUNT(*)
  INTO invalid_checklist_lifecycle_count
  FROM checklists
  WHERE NOT (
    (
      status = 'CREATED'
      AND started_at IS NULL
      AND started_by IS NULL
      AND completed_at IS NULL
      AND completed_by IS NULL
      AND checklist_date IS NULL
      AND result IS NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
      AND invalidated_at IS NULL
      AND invalidated_by IS NULL
      AND invalidation_reason IS NULL
    )
    OR
    (
      status = 'IN_PROGRESS'
      AND started_at IS NOT NULL
      AND started_by IS NOT NULL
      AND completed_at IS NULL
      AND completed_by IS NULL
      AND checklist_date IS NULL
      AND result IS NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
      AND invalidated_at IS NULL
      AND invalidated_by IS NULL
      AND invalidation_reason IS NULL
    )
    OR
    (
      status = 'COMPLETED'
      AND started_at IS NOT NULL
      AND started_by IS NOT NULL
      AND completed_at IS NOT NULL
      AND completed_by IS NOT NULL
      AND checklist_date IS NOT NULL
      AND result IS NOT NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
      AND invalidated_at IS NULL
      AND invalidated_by IS NULL
      AND invalidation_reason IS NULL
    )
    OR
    (
      status = 'CANCELLED'
      AND (
        (started_at IS NULL AND started_by IS NULL)
        OR
        (started_at IS NOT NULL AND started_by IS NOT NULL)
      )
      AND completed_at IS NULL
      AND completed_by IS NULL
      AND checklist_date IS NULL
      AND result IS NULL
      AND cancelled_at IS NOT NULL
      AND cancelled_by IS NOT NULL
      AND cancellation_reason IS NOT NULL
      AND invalidated_at IS NULL
      AND invalidated_by IS NULL
      AND invalidation_reason IS NULL
    )
    OR
    (
      status = 'INVALIDATED'
      AND started_at IS NOT NULL
      AND started_by IS NOT NULL
      AND completed_at IS NOT NULL
      AND completed_by IS NOT NULL
      AND checklist_date IS NOT NULL
      AND result IS NOT NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
      AND invalidated_at IS NOT NULL
      AND invalidated_by IS NOT NULL
      AND invalidation_reason IS NOT NULL
    )
  );

  IF invalid_checklist_lifecycle_count > 0 THEN
    RAISE EXCEPTION
      'checklists contains % rows with inconsistent lifecycle metadata',
      invalid_checklist_lifecycle_count;
  END IF;
END $$;

ALTER TABLE checklist_details
  DROP CONSTRAINT IF EXISTS chk_checklist_details_answer_matches_type,
  DROP CONSTRAINT IF EXISTS chk_checklist_details_answer_value,
  DROP CONSTRAINT IF EXISTS chk_checklist_details_answer_metadata;

ALTER TABLE checklist_details
  ADD CONSTRAINT chk_checklist_details_answer_value
  CHECK (
    (
      answer_boolean IS NULL
      AND answer_integer IS NULL
      AND answer_decimal IS NULL
      AND answer_text IS NULL
      AND answer_date IS NULL
    )
    OR
    (
      answer_type = 'BOOLEAN'
      AND answer_boolean IS NOT NULL
      AND answer_integer IS NULL
      AND answer_decimal IS NULL
      AND answer_text IS NULL
      AND answer_date IS NULL
    )
    OR
    (
      answer_type = 'INTEGER'
      AND answer_boolean IS NULL
      AND answer_integer IS NOT NULL
      AND answer_decimal IS NULL
      AND answer_text IS NULL
      AND answer_date IS NULL
    )
    OR
    (
      answer_type = 'DECIMAL'
      AND answer_boolean IS NULL
      AND answer_integer IS NULL
      AND answer_decimal IS NOT NULL
      AND answer_text IS NULL
      AND answer_date IS NULL
    )
    OR
    (
      answer_type = 'TEXT'
      AND answer_boolean IS NULL
      AND answer_integer IS NULL
      AND answer_decimal IS NULL
      AND answer_text IS NOT NULL
      AND answer_date IS NULL
    )
    OR
    (
      answer_type = 'DATE'
      AND answer_boolean IS NULL
      AND answer_integer IS NULL
      AND answer_decimal IS NULL
      AND answer_text IS NULL
      AND answer_date IS NOT NULL
    )
  ),
  ADD CONSTRAINT chk_checklist_details_answer_metadata
  CHECK (
    (
      answer_boolean IS NULL
      AND answer_integer IS NULL
      AND answer_decimal IS NULL
      AND answer_text IS NULL
      AND answer_date IS NULL
      AND answered_at IS NULL
      AND answered_by IS NULL
    )
    OR
    (
      (
        answer_boolean IS NOT NULL
        OR answer_integer IS NOT NULL
        OR answer_decimal IS NOT NULL
        OR answer_text IS NOT NULL
        OR answer_date IS NOT NULL
      )
      AND answered_at IS NOT NULL
      AND answered_by IS NOT NULL
    )
  );

ALTER TABLE checklists
  DROP CONSTRAINT IF EXISTS chk_checklists_completed_state_required,
  DROP CONSTRAINT IF EXISTS chk_checklists_lifecycle_metadata_state;

ALTER TABLE checklists
  ADD CONSTRAINT chk_checklists_completed_state_required
  CHECK (
    status <> 'COMPLETED'
    OR (
      completed_at IS NOT NULL
      AND completed_by IS NOT NULL
      AND checklist_date IS NOT NULL
      AND result IS NOT NULL
    )
  ),
  ADD CONSTRAINT chk_checklists_lifecycle_metadata_state
  CHECK (
    (
      status = 'CREATED'
      AND started_at IS NULL
      AND started_by IS NULL
      AND completed_at IS NULL
      AND completed_by IS NULL
      AND checklist_date IS NULL
      AND result IS NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
      AND invalidated_at IS NULL
      AND invalidated_by IS NULL
      AND invalidation_reason IS NULL
    )
    OR
    (
      status = 'IN_PROGRESS'
      AND started_at IS NOT NULL
      AND started_by IS NOT NULL
      AND completed_at IS NULL
      AND completed_by IS NULL
      AND checklist_date IS NULL
      AND result IS NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
      AND invalidated_at IS NULL
      AND invalidated_by IS NULL
      AND invalidation_reason IS NULL
    )
    OR
    (
      status = 'COMPLETED'
      AND started_at IS NOT NULL
      AND started_by IS NOT NULL
      AND completed_at IS NOT NULL
      AND completed_by IS NOT NULL
      AND checklist_date IS NOT NULL
      AND result IS NOT NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
      AND invalidated_at IS NULL
      AND invalidated_by IS NULL
      AND invalidation_reason IS NULL
    )
    OR
    (
      status = 'CANCELLED'
      AND (
        (started_at IS NULL AND started_by IS NULL)
        OR
        (started_at IS NOT NULL AND started_by IS NOT NULL)
      )
      AND completed_at IS NULL
      AND completed_by IS NULL
      AND checklist_date IS NULL
      AND result IS NULL
      AND cancelled_at IS NOT NULL
      AND cancelled_by IS NOT NULL
      AND cancellation_reason IS NOT NULL
      AND invalidated_at IS NULL
      AND invalidated_by IS NULL
      AND invalidation_reason IS NULL
    )
    OR
    (
      status = 'INVALIDATED'
      AND started_at IS NOT NULL
      AND started_by IS NOT NULL
      AND completed_at IS NOT NULL
      AND completed_by IS NOT NULL
      AND checklist_date IS NOT NULL
      AND result IS NOT NULL
      AND cancelled_at IS NULL
      AND cancelled_by IS NULL
      AND cancellation_reason IS NULL
      AND invalidated_at IS NOT NULL
      AND invalidated_by IS NOT NULL
      AND invalidation_reason IS NOT NULL
    )
  );

COMMIT;
