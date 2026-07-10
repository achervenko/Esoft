ALTER TABLE audit_log
ADD COLUMN field_name VARCHAR(128),
ADD COLUMN old_value TEXT,
ADD COLUMN new_value TEXT;

UPDATE audit_log
SET
  old_value = CASE
    WHEN changes IS NULL THEN NULL
    ELSE changes::text
  END
WHERE changes IS NOT NULL;

ALTER TABLE audit_log
DROP COLUMN changes;

CREATE INDEX idx_audit_log_field_name
ON audit_log (field_name);

COMMENT ON COLUMN audit_log.field_name IS 'Название измененного поля';
COMMENT ON COLUMN audit_log.old_value IS 'Старое значение поля';
COMMENT ON COLUMN audit_log.new_value IS 'Новое значение поля';
