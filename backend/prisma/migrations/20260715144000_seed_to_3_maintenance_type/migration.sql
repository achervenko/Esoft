INSERT INTO equipment_event_types (code, name, is_active)
VALUES ('TO_3', 'ТО-3', true)
ON CONFLICT DO NOTHING;

UPDATE equipment_event_types
SET is_active = true
WHERE code = 'TO_3';
