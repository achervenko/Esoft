ALTER TABLE equipment_maintenance_settings
    DROP CONSTRAINT IF EXISTS chk_equipment_maintenance_settings_periodicity;

ALTER TABLE equipment_maintenance_settings
    ADD CONSTRAINT chk_equipment_maintenance_settings_periodicity_completeness
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
        )
    );

ALTER TABLE equipment_maintenance_settings
    ADD CONSTRAINT chk_equipment_maintenance_settings_periodicity_non_negative
    CHECK (
        (periodicity_years IS NULL OR periodicity_years >= 0)
        AND (periodicity_months IS NULL OR periodicity_months >= 0)
        AND (periodicity_weeks IS NULL OR periodicity_weeks >= 0)
        AND (periodicity_days IS NULL OR periodicity_days >= 0)
    );

ALTER TABLE equipment_maintenance_settings
    ADD CONSTRAINT chk_equipment_maintenance_settings_periodicity_positive
    CHECK (
        (
            periodicity_years IS NULL
            AND periodicity_months IS NULL
            AND periodicity_weeks IS NULL
            AND periodicity_days IS NULL
        )
        OR
        (
            COALESCE(periodicity_years, 0)
            + COALESCE(periodicity_months, 0)
            + COALESCE(periodicity_weeks, 0)
            + COALESCE(periodicity_days, 0)
        ) > 0
    );
