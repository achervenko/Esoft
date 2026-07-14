CREATE TABLE equipment_event_responsibles (
    equipment_event_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,

    CONSTRAINT pk_equipment_event_responsibles
        PRIMARY KEY (
            equipment_event_id,
            employee_id
        ),

    CONSTRAINT fk_event_responsibles_event
        FOREIGN KEY (equipment_event_id)
        REFERENCES equipment_events(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_event_responsibles_employee
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE RESTRICT
);
