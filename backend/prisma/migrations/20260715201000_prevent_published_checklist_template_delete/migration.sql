CREATE OR REPLACE FUNCTION prevent_published_checklist_template_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_published IS TRUE THEN
        RAISE EXCEPTION
            'Published checklist template % cannot be deleted; archive it instead',
            OLD.id;
    END IF;

    RETURN OLD;
END
$$;

DROP TRIGGER IF EXISTS trg_prevent_published_checklist_template_delete
    ON checklist_templates;

CREATE TRIGGER trg_prevent_published_checklist_template_delete
BEFORE DELETE ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_delete();
