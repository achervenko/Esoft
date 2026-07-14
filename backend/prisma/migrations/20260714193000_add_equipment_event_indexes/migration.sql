CREATE INDEX idx_equipment_events_equipment_id
    ON equipment_events (equipment_id);

CREATE INDEX idx_equipment_events_event_type_id
    ON equipment_events (event_type_id);

CREATE INDEX idx_equipment_events_status
    ON equipment_events (status);

CREATE INDEX idx_equipment_events_planned_date
    ON equipment_events (planned_date);

CREATE INDEX idx_equipment_events_fact_date
    ON equipment_events (fact_date);

CREATE INDEX idx_event_responsibles_employee_id
    ON equipment_event_responsibles (employee_id);
