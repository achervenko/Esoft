ALTER TABLE equipment_events
    ADD COLUMN maintenance_setting_id INTEGER,
    ADD COLUMN execution_type equipment_maintenance_execution_type,
    ADD COLUMN checklist_template_id INTEGER,
    ADD COLUMN note TEXT;

UPDATE equipment_events event
SET
    maintenance_setting_id = snapshot.maintenance_setting_id,
    execution_type = snapshot.execution_type,
    checklist_template_id = snapshot.checklist_template_id
FROM (
    SELECT
        event.id AS event_id,
        setting.id AS maintenance_setting_id,
        COALESCE(
            setting.execution_type,
            'INTERNAL'::equipment_maintenance_execution_type
        ) AS execution_type,
        setting.checklist_template_id
    FROM equipment_events event
    JOIN equipment equipment
        ON equipment.id = event.equipment_id
    LEFT JOIN equipment_maintenance_settings setting
        ON setting.equipment_model_id = equipment.model_id
       AND setting.maintenance_type_id = event.event_type_id
) snapshot
WHERE event.id = snapshot.event_id;

UPDATE equipment_events
SET execution_type = 'INTERNAL'::equipment_maintenance_execution_type
WHERE execution_type IS NULL;

ALTER TABLE equipment_events
    ALTER COLUMN execution_type SET NOT NULL;

ALTER TABLE equipment_events
    ADD CONSTRAINT fk_equipment_events_maintenance_setting
    FOREIGN KEY (maintenance_setting_id)
    REFERENCES equipment_maintenance_settings(id)
    ON DELETE SET NULL;

CREATE INDEX idx_equipment_events_maintenance_setting_id
    ON equipment_events (maintenance_setting_id);
