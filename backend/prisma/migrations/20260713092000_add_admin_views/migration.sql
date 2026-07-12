CREATE OR REPLACE VIEW admin_equipment_full AS
SELECT
    e.id,
    e.visible_id,
    e.inventory_number,
    e.serial_number,
    e.name AS equipment_name,
    e.model,
    e.specifications,

    e.manufacturer_id,
    m.name AS manufacturer_name,

    e.country_id,
    c.name AS country_name,
    c.iso AS country_iso,

    e.manufacture_year,
    e.commissioning_date,
    e.issue_date,

    e.section_id,
    s.name AS section_name,

    s.workshop_id,
    w.name AS workshop_name,

    e.responsible_employee_id,
    concat_ws(
        ' ',
        emp.last_name,
        emp.first_name,
        emp.middle_name
    ) AS responsible_employee_name,
    emp.position AS responsible_employee_position,

    e.status,
    e.operation_text,
    e.notes

FROM equipment e
LEFT JOIN manufacturers m
    ON m.id = e.manufacturer_id
LEFT JOIN countries c
    ON c.id = e.country_id
JOIN sections s
    ON s.id = e.section_id
JOIN workshops w
    ON w.id = s.workshop_id
JOIN employees emp
    ON emp.id = e.responsible_employee_id;

CREATE OR REPLACE VIEW admin_organization_structure AS
SELECT
    w.id AS workshop_id,
    w.name AS workshop_name,
    s.id AS section_id,
    s.name AS section_name,

    COUNT(e.id) AS equipment_count

FROM workshops w
LEFT JOIN sections s
    ON s.workshop_id = w.id
LEFT JOIN equipment e
    ON e.section_id = s.id
GROUP BY
    w.id,
    w.name,
    s.id,
    s.name;

CREATE OR REPLACE VIEW admin_audit_log_full AS
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
