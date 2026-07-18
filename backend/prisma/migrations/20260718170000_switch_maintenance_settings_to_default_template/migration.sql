ALTER TABLE equipment_maintenance_settings
    ADD COLUMN IF NOT EXISTS default_checklist_template_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_settings_default_template_id
    ON equipment_maintenance_settings (default_checklist_template_id);

ALTER TABLE equipment_maintenance_settings
    DROP CONSTRAINT IF EXISTS fk_equipment_maintenance_settings_default_template;

ALTER TABLE equipment_maintenance_settings
    ADD CONSTRAINT fk_equipment_maintenance_settings_default_template
    FOREIGN KEY (default_checklist_template_id)
    REFERENCES checklist_templates(id)
    ON DELETE RESTRICT;

WITH ranked_links AS (
    SELECT
        link.maintenance_setting_id,
        link.checklist_template_id,
        ROW_NUMBER() OVER (
            PARTITION BY link.maintenance_setting_id
            ORDER BY link.sort_order, link.id
        ) AS row_number
    FROM equipment_maintenance_setting_checklist_templates link
)
UPDATE equipment_maintenance_settings setting
SET default_checklist_template_id = ranked_links.checklist_template_id
FROM ranked_links
WHERE ranked_links.maintenance_setting_id = setting.id
  AND ranked_links.row_number = 1
  AND setting.default_checklist_template_id IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM checklists
        GROUP BY equipment_event_id, assigned_user_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot create uq_checklists_event_assigned_user: duplicate (equipment_event_id, assigned_user_id) rows exist';
    END IF;
END
$$;

ALTER TABLE checklists
    DROP CONSTRAINT IF EXISTS uq_checklists_event_template;

ALTER TABLE checklists
    DROP CONSTRAINT IF EXISTS checklists_is_required_fkey;

ALTER TABLE checklists
    DROP COLUMN IF EXISTS is_required;

ALTER TABLE checklists
    ADD CONSTRAINT uq_checklists_event_assigned_user
    UNIQUE (equipment_event_id, assigned_user_id);

DROP TABLE IF EXISTS equipment_maintenance_setting_checklist_templates;
