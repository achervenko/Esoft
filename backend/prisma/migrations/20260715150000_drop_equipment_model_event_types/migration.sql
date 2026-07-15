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

ALTER TABLE equipment_maintenance_settings
    DROP CONSTRAINT IF EXISTS chk_equipment_maintenance_settings_periodicity;

ALTER TABLE equipment_maintenance_settings
    ADD CONSTRAINT chk_equipment_maintenance_settings_periodicity
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

DROP TABLE IF EXISTS equipment_model_event_types;
