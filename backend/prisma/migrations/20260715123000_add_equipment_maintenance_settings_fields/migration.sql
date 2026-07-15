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
ADD COLUMN periodicity_years integer,
ADD COLUMN periodicity_months integer,
ADD COLUMN periodicity_weeks integer,
ADD COLUMN periodicity_days integer,
ADD COLUMN execution_type equipment_maintenance_execution_type NOT NULL;

ALTER TABLE equipment_model_event_types
ADD CONSTRAINT chk_model_event_types_periodicity
CHECK (
    (
        periodicity_years IS NULL
        AND periodicity_months IS NULL
        AND periodicity_weeks IS NULL
        AND periodicity_days IS NULL
    )
    OR
    (
        periodicity_years IS NOT NULL
        AND periodicity_months IS NOT NULL
        AND periodicity_weeks IS NOT NULL
        AND periodicity_days IS NOT NULL
        AND
        periodicity_years >= 0
        AND periodicity_months >= 0
        AND periodicity_weeks >= 0
        AND periodicity_days >= 0
        AND (
            periodicity_years > 0
            OR periodicity_months > 0
            OR periodicity_weeks > 0
            OR periodicity_days > 0
        )
    )
);
