-- Technical backfill from the legacy single-template column.
-- Existing links must be preserved losslessly even if an old template is no
-- longer published or active; runtime writes remain protected after migration.
ALTER TABLE equipment_maintenance_setting_checklist_templates
    DISABLE TRIGGER trg_validate_setting_checklist_template;

INSERT INTO equipment_maintenance_setting_checklist_templates (
    maintenance_setting_id,
    checklist_template_id,
    is_required,
    sort_order,
    created_by
)
SELECT
    setting.id,
    setting.checklist_template_id,
    true,
    COALESCE(
        (
            SELECT MAX(existing_link.sort_order)
            FROM equipment_maintenance_setting_checklist_templates existing_link
            WHERE existing_link.maintenance_setting_id = setting.id
        ),
        0
    ) + 1,
    template.created_by
FROM equipment_maintenance_settings setting
JOIN checklist_templates template
    ON template.id = setting.checklist_template_id
WHERE setting.checklist_template_id IS NOT NULL
ON CONFLICT (maintenance_setting_id, checklist_template_id) DO NOTHING;

ALTER TABLE equipment_maintenance_setting_checklist_templates
    ENABLE TRIGGER trg_validate_setting_checklist_template;

ALTER TABLE equipment_maintenance_settings
    DROP COLUMN checklist_template_id;
