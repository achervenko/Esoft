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

INSERT INTO equipment_event_types (code, name, is_active)
VALUES
    ('TO_1', 'ТО-1', true),
    ('TO_2', 'ТО-2', true),
    ('DIAGNOSTICS', 'Диагностика', true),
    ('REPAIR', 'Ремонт', true)
ON CONFLICT DO NOTHING;

UPDATE equipment_event_types
SET is_active = true
WHERE code IN ('TO_1', 'TO_2', 'DIAGNOSTICS', 'REPAIR');

CREATE TABLE IF NOT EXISTS equipment_maintenance_settings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    equipment_model_id INTEGER NOT NULL,
    maintenance_type_id INTEGER NOT NULL,
    execution_type equipment_maintenance_execution_type NOT NULL,
    periodicity_years INTEGER,
    periodicity_months INTEGER,
    periodicity_weeks INTEGER,
    periodicity_days INTEGER,
    checklist_template_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_equipment_maintenance_settings_model
        FOREIGN KEY (equipment_model_id)
        REFERENCES equipment_models(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_equipment_maintenance_settings_type
        FOREIGN KEY (maintenance_type_id)
        REFERENCES equipment_event_types(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_equipment_maintenance_settings_model_type
        UNIQUE (equipment_model_id, maintenance_type_id),

    CONSTRAINT chk_equipment_maintenance_settings_periodicity
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
        )
);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_settings_type_id
    ON equipment_maintenance_settings (maintenance_type_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'equipment_model_event_types'
    ) THEN
        INSERT INTO equipment_maintenance_settings (
            equipment_model_id,
            maintenance_type_id,
            execution_type,
            periodicity_years,
            periodicity_months,
            periodicity_weeks,
            periodicity_days,
            checklist_template_id
        )
        SELECT
            equipment_model_id,
            event_type_id,
            execution_type,
            periodicity_years,
            periodicity_months,
            periodicity_weeks,
            periodicity_days,
            checklist_template_id
        FROM equipment_model_event_types
        ON CONFLICT (equipment_model_id, maintenance_type_id) DO NOTHING;
    END IF;
END
$$;
