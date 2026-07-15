ALTER TABLE equipment_events
ADD COLUMN version integer NOT NULL DEFAULT 1;

CREATE INDEX idx_equipment_events_id_version
    ON equipment_events (id, version);
