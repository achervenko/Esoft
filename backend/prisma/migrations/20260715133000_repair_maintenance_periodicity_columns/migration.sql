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
ADD COLUMN IF NOT EXISTS periodicity_years integer,
ADD COLUMN IF NOT EXISTS periodicity_months integer,
ADD COLUMN IF NOT EXISTS periodicity_weeks integer,
ADD COLUMN IF NOT EXISTS periodicity_days integer,
ADD COLUMN IF NOT EXISTS execution_type equipment_maintenance_execution_type;

UPDATE equipment_model_event_types
SET execution_type = 'INTERNAL'
WHERE execution_type IS NULL;

ALTER TABLE equipment_model_event_types
ALTER COLUMN execution_type SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'equipment_model_event_types'
          AND column_name = 'periodicity_value'
    )
    AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'equipment_model_event_types'
          AND column_name = 'periodicity_unit'
    ) THEN
        EXECUTE $sql$
            UPDATE equipment_model_event_types
            SET
                periodicity_years = CASE WHEN periodicity_unit::text = 'YEAR' THEN periodicity_value ELSE 0 END,
                periodicity_months = CASE WHEN periodicity_unit::text = 'MONTH' THEN periodicity_value ELSE 0 END,
                periodicity_weeks = CASE WHEN periodicity_unit::text = 'WEEK' THEN periodicity_value ELSE 0 END,
                periodicity_days = CASE WHEN periodicity_unit::text = 'DAY' THEN periodicity_value ELSE 0 END
            WHERE periodicity_value IS NOT NULL
              AND periodicity_unit IS NOT NULL
              AND periodicity_years IS NULL
              AND periodicity_months IS NULL
              AND periodicity_weeks IS NULL
              AND periodicity_days IS NULL
        $sql$;
    END IF;
END
$$;

ALTER TABLE equipment_model_event_types
DROP CONSTRAINT IF EXISTS chk_model_event_types_periodicity;

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
        AND periodicity_years >= 0
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

ALTER TABLE equipment_model_event_types
DROP COLUMN IF EXISTS periodicity_value,
DROP COLUMN IF EXISTS periodicity_unit;

DROP TYPE IF EXISTS equipment_maintenance_periodicity_unit;
