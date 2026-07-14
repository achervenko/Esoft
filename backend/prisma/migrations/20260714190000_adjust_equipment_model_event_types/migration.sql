ALTER TABLE equipment_model_event_types
    DROP CONSTRAINT fk_model_event_types_event_type;

ALTER TABLE equipment_model_event_types
    ALTER COLUMN event_type_id TYPE INTEGER;

ALTER TABLE equipment_event_types
    ALTER COLUMN id TYPE INTEGER;

ALTER TABLE equipment_model_event_types
    ADD COLUMN checklist_template_id INTEGER;

ALTER TABLE equipment_model_event_types
    ADD CONSTRAINT fk_model_event_types_event_type
        FOREIGN KEY (event_type_id)
        REFERENCES equipment_event_types(id)
        ON DELETE RESTRICT;
