DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'equipment_maintenance_periodicity_unit'
    ) THEN
        CREATE TYPE equipment_maintenance_periodicity_unit AS ENUM (
            'DAY',
            'WEEK',
            'MONTH',
            'YEAR'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'equipment_maintenance_execution_type'
    ) THEN
        CREATE TYPE equipment_maintenance_execution_type AS ENUM (
            'INTERNAL',
            'EXTERNAL'
        );
    END IF;
END
$$;

ALTER TABLE equipment_model_event_types
ADD COLUMN periodicity_value integer,
ADD COLUMN periodicity_unit equipment_maintenance_periodicity_unit,
ADD COLUMN execution_type equipment_maintenance_execution_type NOT NULL;

ALTER TABLE equipment_model_event_types
ADD CONSTRAINT chk_model_event_types_periodicity_pair
CHECK (
    (
        periodicity_value IS NULL
        AND periodicity_unit IS NULL
    )
    OR
    (
        periodicity_value IS NOT NULL
        AND periodicity_unit IS NOT NULL
    )
);

ALTER TABLE equipment_model_event_types
ADD CONSTRAINT chk_model_event_types_periodicity_positive
CHECK (
    periodicity_value IS NULL
    OR periodicity_value > 0
);
