DROP TRIGGER IF EXISTS trg_prevent_published_checklist_template_key_update
    ON checklist_templates;

DROP FUNCTION IF EXISTS prevent_published_checklist_template_key_update();

DROP INDEX IF EXISTS "idx_checklist_templates_equipment_model_id";
DROP INDEX IF EXISTS "idx_checklist_templates_maintenance_type_id";

ALTER TABLE "checklist_templates"
  DROP CONSTRAINT IF EXISTS "checklist_templates_equipment_model_id_fkey",
  DROP CONSTRAINT IF EXISTS "checklist_templates_maintenance_type_id_fkey",
  DROP COLUMN IF EXISTS "equipment_model_id",
  DROP COLUMN IF EXISTS "maintenance_type_id";

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
       AND NEW.based_on_template_id IS DISTINCT FROM OLD.based_on_template_id THEN
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
    based_on_template_id
ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_key_update();
