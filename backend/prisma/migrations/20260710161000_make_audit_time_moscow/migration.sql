ALTER TABLE audit_log
ALTER COLUMN created_at TYPE TIMESTAMP(6)
USING created_at AT TIME ZONE 'Europe/Moscow';

ALTER TABLE audit_log
ALTER COLUMN created_at SET DEFAULT timezone('Europe/Moscow'::text, now());

ALTER TABLE audit_log
ADD COLUMN time_zone VARCHAR(32) NOT NULL DEFAULT 'Europe/Moscow (UTC+03:00)';

COMMENT ON COLUMN audit_log.created_at IS 'Дата и время события по московскому времени';
COMMENT ON COLUMN audit_log.time_zone IS 'Временная зона, в которой записано время события';
