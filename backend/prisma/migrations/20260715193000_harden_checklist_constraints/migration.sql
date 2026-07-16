ALTER TABLE checklists
    ADD COLUMN started_by TEXT,
    ADD COLUMN completed_by TEXT;

ALTER TABLE checklists
    ADD CONSTRAINT fk_checklists_started_by
    FOREIGN KEY (started_by)
    REFERENCES "user"(id)
    ON DELETE RESTRICT;

ALTER TABLE checklists
    ADD CONSTRAINT fk_checklists_completed_by
    FOREIGN KEY (completed_by)
    REFERENCES "user"(id)
    ON DELETE RESTRICT;

UPDATE checklists
SET
    started_by = assigned_user_id
WHERE started_at IS NOT NULL
  AND started_by IS NULL;

UPDATE checklists
SET
    completed_by = assigned_user_id
WHERE completed_at IS NOT NULL
  AND completed_by IS NULL;

ALTER TABLE checklists
    DROP CONSTRAINT fk_checklists_event,
    ADD CONSTRAINT fk_checklists_event
    FOREIGN KEY (equipment_event_id)
    REFERENCES equipment_events(id)
    ON DELETE RESTRICT;

ALTER TABLE checklists
    DROP CONSTRAINT chk_checklists_result_completed,
    DROP CONSTRAINT chk_checklists_started_at,
    DROP CONSTRAINT chk_checklists_completed_at;

ALTER TABLE checklists
    ADD CONSTRAINT chk_checklists_result_terminal
    CHECK (
        (
            status IN ('COMPLETED', 'INVALIDATED')
            AND result IS NOT NULL
        )
        OR
        (
            status NOT IN ('COMPLETED', 'INVALIDATED')
            AND result IS NULL
        )
    ),
    ADD CONSTRAINT chk_checklists_started_at
    CHECK (
        status NOT IN ('IN_PROGRESS', 'COMPLETED', 'INVALIDATED')
        OR (
            started_at IS NOT NULL
            AND started_by IS NOT NULL
        )
    ),
    ADD CONSTRAINT chk_checklists_completed_at
    CHECK (
        status NOT IN ('COMPLETED', 'INVALIDATED')
        OR (
            completed_at IS NOT NULL
            AND completed_by IS NOT NULL
        )
    );

ALTER TABLE checklist_templates
    ADD CONSTRAINT chk_checklist_templates_state_consistency
    CHECK (
        (is_active = false OR is_published = true)
        AND
        (archived_at IS NULL OR is_active = false)
        AND
        (is_active = false OR archived_at IS NULL)
    );

ALTER TABLE checklist_modules
    ADD CONSTRAINT chk_checklist_modules_name_not_blank
    CHECK (btrim(name) <> '');

ALTER TABLE checklist_questions
    ADD CONSTRAINT chk_checklist_questions_text_not_blank
    CHECK (btrim(question_text) <> '');

ALTER TABLE checklist_templates
    ADD CONSTRAINT chk_checklist_templates_name_not_blank
    CHECK (btrim(name) <> '');

ALTER TABLE checklist_template_modules
    ADD CONSTRAINT chk_checklist_template_modules_name_not_blank
    CHECK (btrim(module_name_snapshot) <> '');

ALTER TABLE checklist_template_questions
    ADD CONSTRAINT chk_checklist_template_questions_text_not_blank
    CHECK (btrim(question_text_snapshot) <> '');

ALTER TABLE checklists
    ADD CONSTRAINT chk_checklists_cancellation_reason_not_blank
    CHECK (
        cancellation_reason IS NULL
        OR btrim(cancellation_reason) <> ''
    ),
    ADD CONSTRAINT chk_checklists_invalidation_reason_not_blank
    CHECK (
        invalidation_reason IS NULL
        OR btrim(invalidation_reason) <> ''
    );

ALTER TABLE checklist_details
    ADD CONSTRAINT chk_checklist_details_module_name_not_blank
    CHECK (btrim(module_name) <> ''),
    ADD CONSTRAINT chk_checklist_details_question_text_not_blank
    CHECK (btrim(question_text) <> '');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END
$$;

CREATE TRIGGER trg_checklist_modules_set_updated_at
BEFORE UPDATE ON checklist_modules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_checklist_questions_set_updated_at
BEFORE UPDATE ON checklist_questions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_checklist_templates_set_updated_at
BEFORE UPDATE ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION validate_checklist_template_question_module()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    template_module_id INTEGER;
    question_module_id INTEGER;
BEGIN
    SELECT checklist_module_id
    INTO template_module_id
    FROM checklist_template_modules
    WHERE id = NEW.checklist_template_module_id;

    SELECT checklist_module_id
    INTO question_module_id
    FROM checklist_questions
    WHERE id = NEW.checklist_question_id;

    IF template_module_id IS DISTINCT FROM question_module_id THEN
        RAISE EXCEPTION
            'Checklist question % belongs to module %, not template module %',
            NEW.checklist_question_id,
            question_module_id,
            template_module_id;
    END IF;

    RETURN NEW;
END
$$;

CREATE TRIGGER trg_validate_checklist_template_question_module
BEFORE INSERT OR UPDATE OF checklist_template_module_id, checklist_question_id
ON checklist_template_questions
FOR EACH ROW
EXECUTE FUNCTION validate_checklist_template_question_module();

CREATE OR REPLACE FUNCTION validate_setting_checklist_template()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    setting_equipment_model_id INTEGER;
    setting_maintenance_type_id INTEGER;
    template_equipment_model_id INTEGER;
    template_maintenance_type_id INTEGER;
    template_is_published BOOLEAN;
    template_is_active BOOLEAN;
BEGIN
    SELECT
        equipment_model_id,
        maintenance_type_id
    INTO
        setting_equipment_model_id,
        setting_maintenance_type_id
    FROM equipment_maintenance_settings
    WHERE id = NEW.maintenance_setting_id;

    SELECT
        equipment_model_id,
        maintenance_type_id,
        is_published,
        is_active
    INTO
        template_equipment_model_id,
        template_maintenance_type_id,
        template_is_published,
        template_is_active
    FROM checklist_templates
    WHERE id = NEW.checklist_template_id;

    IF template_equipment_model_id IS DISTINCT FROM setting_equipment_model_id
       OR template_maintenance_type_id IS DISTINCT FROM setting_maintenance_type_id THEN
        RAISE EXCEPTION
            'Checklist template % does not match maintenance setting %',
            NEW.checklist_template_id,
            NEW.maintenance_setting_id;
    END IF;

    IF template_is_published IS NOT TRUE OR template_is_active IS NOT TRUE THEN
        RAISE EXCEPTION
            'Checklist template % must be published and active',
            NEW.checklist_template_id;
    END IF;

    RETURN NEW;
END
$$;

CREATE TRIGGER trg_validate_setting_checklist_template
BEFORE INSERT OR UPDATE OF maintenance_setting_id, checklist_template_id
ON equipment_maintenance_setting_checklist_templates
FOR EACH ROW
EXECUTE FUNCTION validate_setting_checklist_template();

CREATE OR REPLACE FUNCTION validate_checklist_event_template()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    event_equipment_id INTEGER;
    event_type_id INTEGER;
    event_maintenance_setting_id INTEGER;
    event_equipment_model_id INTEGER;
    template_equipment_model_id INTEGER;
    template_maintenance_type_id INTEGER;
BEGIN
    SELECT
        equipment_event.equipment_id,
        equipment_event.event_type_id,
        equipment_event.maintenance_setting_id,
        equipment.model_id
    INTO
        event_equipment_id,
        event_type_id,
        event_maintenance_setting_id,
        event_equipment_model_id
    FROM equipment_events equipment_event
    JOIN equipment
        ON equipment.id = equipment_event.equipment_id
    WHERE equipment_event.id = NEW.equipment_event_id;

    IF NEW.equipment_id IS DISTINCT FROM event_equipment_id THEN
        RAISE EXCEPTION
            'Checklist equipment % does not match event equipment %',
            NEW.equipment_id,
            event_equipment_id;
    END IF;

    SELECT
        equipment_model_id,
        maintenance_type_id
    INTO
        template_equipment_model_id,
        template_maintenance_type_id
    FROM checklist_templates
    WHERE id = NEW.checklist_template_id;

    IF template_equipment_model_id IS DISTINCT FROM event_equipment_model_id
       OR template_maintenance_type_id IS DISTINCT FROM event_type_id THEN
        RAISE EXCEPTION
            'Checklist template % does not match equipment event %',
            NEW.checklist_template_id,
            NEW.equipment_event_id;
    END IF;

    IF event_maintenance_setting_id IS NULL THEN
        RAISE EXCEPTION
            'Equipment event % has no maintenance setting for checklist template %',
            NEW.equipment_event_id,
            NEW.checklist_template_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM equipment_maintenance_setting_checklist_templates setting_template
        WHERE setting_template.maintenance_setting_id = event_maintenance_setting_id
          AND setting_template.checklist_template_id = NEW.checklist_template_id
    ) THEN
        RAISE EXCEPTION
            'Checklist template % is not linked to event maintenance setting %',
            NEW.checklist_template_id,
            event_maintenance_setting_id;
    END IF;

    RETURN NEW;
END
$$;

CREATE TRIGGER trg_validate_checklist_event_template
BEFORE INSERT OR UPDATE OF equipment_event_id, equipment_id, checklist_template_id
ON checklists
FOR EACH ROW
EXECUTE FUNCTION validate_checklist_event_template();
