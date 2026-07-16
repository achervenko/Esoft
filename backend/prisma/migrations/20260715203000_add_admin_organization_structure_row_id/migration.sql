CREATE OR REPLACE VIEW admin_organization_structure AS
SELECT
    w.id AS workshop_id,
    w.name AS workshop_name,
    s.id AS section_id,
    s.name AS section_name,

    COUNT(e.id) AS equipment_count,

    CASE
        WHEN s.id IS NULL THEN -w.id
        ELSE s.id
    END AS row_id

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
