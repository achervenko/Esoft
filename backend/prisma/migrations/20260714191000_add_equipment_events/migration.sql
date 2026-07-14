CREATE TYPE equipment_event_source AS ENUM (
    'MANUAL',
    'PLANNED'
);

CREATE TYPE equipment_event_status AS ENUM (
    'CREATED',
    'COMPLETED',
    'CANCELLED'
);

CREATE TABLE equipment_events (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    equipment_id INTEGER NOT NULL,
    event_type_id INTEGER NOT NULL,

    source equipment_event_source NOT NULL,
    status equipment_event_status NOT NULL DEFAULT 'CREATED',

    original_planned_date DATE,
    planned_date DATE,
    fact_date DATE,

    created_by_employee_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_equipment_events_equipment
        FOREIGN KEY (equipment_id)
        REFERENCES equipment(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_equipment_events_event_type
        FOREIGN KEY (event_type_id)
        REFERENCES equipment_event_types(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_equipment_events_created_by
        FOREIGN KEY (created_by_employee_id)
        REFERENCES employees(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_equipment_events_planned_dates
        CHECK (
            (
                original_planned_date IS NULL
                AND planned_date IS NULL
            )
            OR
            (
                original_planned_date IS NOT NULL
                AND planned_date IS NOT NULL
            )
        ),

    CONSTRAINT chk_equipment_events_completed
        CHECK (
            status <> 'COMPLETED'
            OR fact_date IS NOT NULL
        )
);
