ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS entity_string_id VARCHAR(128);

COMMENT ON COLUMN audit_log.entity_string_id IS 'Строковый идентификатор объекта';

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_string
    ON audit_log(entity_type, entity_string_id);

DROP VIEW IF EXISTS admin_audit_log_full;

CREATE VIEW admin_audit_log_full AS
SELECT
    al.id,
    al.created_at,
    al.user_id,
    u.username,
    u.name AS user_name,
    emp.id AS employee_id,
    concat_ws(
        ' ',
        emp.last_name,
        emp.first_name,
        emp.middle_name
    ) AS employee_full_name,
    al.action,
    al.module,
    al.entity_type,
    al.entity_id,
    al.entity_string_id,
    al.field_name,
    al.old_value,
    al.new_value,
    al.time_zone
FROM audit_log al
LEFT JOIN "user" u
    ON u.id = al.user_id
LEFT JOIN employee_users eu
    ON eu.user_id = u.id
LEFT JOIN employees emp
    ON emp.id = eu.employee_id;
