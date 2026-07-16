CREATE OR REPLACE FUNCTION set_checklist_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_checklist_modules_set_updated_at
    ON checklist_modules;

DROP TRIGGER IF EXISTS trg_checklist_questions_set_updated_at
    ON checklist_questions;

DROP TRIGGER IF EXISTS trg_checklist_templates_set_updated_at
    ON checklist_templates;

CREATE TRIGGER trg_checklist_modules_set_updated_at
BEFORE UPDATE ON checklist_modules
FOR EACH ROW
EXECUTE FUNCTION set_checklist_updated_at();

CREATE TRIGGER trg_checklist_questions_set_updated_at
BEFORE UPDATE ON checklist_questions
FOR EACH ROW
EXECUTE FUNCTION set_checklist_updated_at();

CREATE TRIGGER trg_checklist_templates_set_updated_at
BEFORE UPDATE ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION set_checklist_updated_at();

DROP FUNCTION IF EXISTS set_updated_at();

ALTER TABLE checklist_templates
    DROP CONSTRAINT chk_checklist_templates_state_consistency,
    ADD CONSTRAINT chk_checklist_templates_state_consistency
    CHECK (
        (is_active = false OR is_published = true)
        AND
        (archived_at IS NULL OR is_active = false)
    );

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

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Checklist template module % not found',
            NEW.checklist_template_module_id;
    END IF;

    SELECT checklist_module_id
    INTO question_module_id
    FROM checklist_questions
    WHERE id = NEW.checklist_question_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Checklist question % not found',
            NEW.checklist_question_id;
    END IF;

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

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Equipment maintenance setting % not found',
            NEW.maintenance_setting_id;
    END IF;

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

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Checklist template % not found',
            NEW.checklist_template_id;
    END IF;

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
    template_is_published BOOLEAN;
    template_is_active BOOLEAN;
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

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Equipment event % not found',
            NEW.equipment_event_id;
    END IF;

    IF NEW.equipment_id IS DISTINCT FROM event_equipment_id THEN
        RAISE EXCEPTION
            'Checklist equipment % does not match event equipment %',
            NEW.equipment_id,
            event_equipment_id;
    END IF;

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

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Checklist template % not found',
            NEW.checklist_template_id;
    END IF;

    IF template_is_published IS NOT TRUE OR template_is_active IS NOT TRUE THEN
        RAISE EXCEPTION
            'Checklist template % must be published and active',
            NEW.checklist_template_id;
    END IF;

    IF template_equipment_model_id IS DISTINCT FROM event_equipment_model_id
       OR template_maintenance_type_id IS DISTINCT FROM event_type_id THEN
        RAISE EXCEPTION
            'Checklist template % does not match equipment event %',
            NEW.checklist_template_id,
            NEW.equipment_event_id;
    END IF;

    IF event_maintenance_setting_id IS NOT NULL
       AND NOT EXISTS (
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

CREATE OR REPLACE FUNCTION prevent_published_checklist_template_key_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_published IS TRUE
       AND (
            NEW.equipment_model_id IS DISTINCT FROM OLD.equipment_model_id
            OR NEW.maintenance_type_id IS DISTINCT FROM OLD.maintenance_type_id
            OR NEW.based_on_template_id IS DISTINCT FROM OLD.based_on_template_id
        ) THEN
        RAISE EXCEPTION
            'Published checklist template % key fields cannot be changed',
            OLD.id;
    END IF;

    RETURN NEW;
END
$$;

CREATE TRIGGER trg_prevent_published_checklist_template_key_update
BEFORE UPDATE OF equipment_model_id, maintenance_type_id, based_on_template_id
ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_key_update();

CREATE OR REPLACE FUNCTION prevent_published_checklist_template_structure_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_template_id INTEGER;
    published_template_id INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'checklist_template_modules' THEN
        IF TG_OP = 'DELETE' THEN
            target_template_id = OLD.checklist_template_id;
        ELSE
            target_template_id = NEW.checklist_template_id;
        END IF;
    ELSE
        SELECT checklist_template_id
        INTO target_template_id
        FROM checklist_template_modules
        WHERE id = CASE
            WHEN TG_OP = 'DELETE' THEN OLD.checklist_template_module_id
            ELSE NEW.checklist_template_module_id
        END;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Checklist template module % not found',
                CASE
                    WHEN TG_OP = 'DELETE' THEN OLD.checklist_template_module_id
                    ELSE NEW.checklist_template_module_id
                END;
        END IF;
    END IF;

    SELECT id
    INTO published_template_id
    FROM checklist_templates
    WHERE id = target_template_id
      AND is_published = true;

    IF FOUND THEN
        RAISE EXCEPTION
            'Published checklist template % structure cannot be changed',
            published_template_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END
$$;

CREATE TRIGGER trg_prevent_published_template_module_insert
BEFORE INSERT ON checklist_template_modules
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_module_update
BEFORE UPDATE ON checklist_template_modules
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_module_delete
BEFORE DELETE ON checklist_template_modules
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_question_insert
BEFORE INSERT ON checklist_template_questions
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_question_update
BEFORE UPDATE ON checklist_template_questions
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_question_delete
BEFORE DELETE ON checklist_template_questions
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();
