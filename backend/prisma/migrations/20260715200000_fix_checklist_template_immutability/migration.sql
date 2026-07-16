DROP TRIGGER IF EXISTS trg_prevent_published_checklist_template_key_update
    ON checklist_templates;

DROP TRIGGER IF EXISTS trg_prevent_published_template_module_insert
    ON checklist_template_modules;

DROP TRIGGER IF EXISTS trg_prevent_published_template_module_update
    ON checklist_template_modules;

DROP TRIGGER IF EXISTS trg_prevent_published_template_module_delete
    ON checklist_template_modules;

DROP TRIGGER IF EXISTS trg_prevent_published_template_question_insert
    ON checklist_template_questions;

DROP TRIGGER IF EXISTS trg_prevent_published_template_question_update
    ON checklist_template_questions;

DROP TRIGGER IF EXISTS trg_prevent_published_template_question_delete
    ON checklist_template_questions;

CREATE OR REPLACE FUNCTION prevent_published_checklist_template_key_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_published IS TRUE AND NEW.is_published IS NOT TRUE THEN
        RAISE EXCEPTION
            'Published checklist template % cannot be reverted to draft',
            OLD.id;
    END IF;

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
BEFORE UPDATE OF
    is_published,
    equipment_model_id,
    maintenance_type_id,
    based_on_template_id
ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_key_update();

CREATE OR REPLACE FUNCTION raise_if_checklist_template_is_published(
    checklist_template_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    published_template_id INTEGER;
BEGIN
    SELECT id
    INTO published_template_id
    FROM checklist_templates
    WHERE id = checklist_template_id
      AND is_published = true;

    IF FOUND THEN
        RAISE EXCEPTION
            'Published checklist template % structure cannot be changed',
            published_template_id;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION get_checklist_template_id_by_module(
    checklist_template_module_id INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_template_id INTEGER;
BEGIN
    SELECT checklist_template_id
    INTO target_template_id
    FROM checklist_template_modules
    WHERE id = checklist_template_module_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Checklist template module % not found',
            checklist_template_module_id;
    END IF;

    RETURN target_template_id;
END
$$;

CREATE OR REPLACE FUNCTION prevent_published_checklist_template_structure_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_TABLE_NAME = 'checklist_template_modules' THEN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
            PERFORM raise_if_checklist_template_is_published(
                OLD.checklist_template_id
            );
        END IF;

        IF TG_OP IN ('INSERT', 'UPDATE') THEN
            PERFORM raise_if_checklist_template_is_published(
                NEW.checklist_template_id
            );
        END IF;
    ELSE
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
            PERFORM raise_if_checklist_template_is_published(
                get_checklist_template_id_by_module(
                    OLD.checklist_template_module_id
                )
            );
        END IF;

        IF TG_OP IN ('INSERT', 'UPDATE') THEN
            PERFORM raise_if_checklist_template_is_published(
                get_checklist_template_id_by_module(
                    NEW.checklist_template_module_id
                )
            );
        END IF;
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
