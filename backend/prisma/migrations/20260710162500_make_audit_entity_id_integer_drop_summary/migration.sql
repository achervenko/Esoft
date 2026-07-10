ALTER TABLE audit_log
ALTER COLUMN entity_id TYPE INTEGER
USING CASE
  WHEN entity_id ~ '^\d+$' THEN entity_id::integer
  ELSE NULL
END;

ALTER TABLE audit_log
DROP COLUMN summary;

COMMENT ON COLUMN audit_log.entity_id IS 'Внутренний идентификатор объекта';
