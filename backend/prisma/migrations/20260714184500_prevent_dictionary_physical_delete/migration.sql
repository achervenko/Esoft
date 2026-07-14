ALTER TABLE equipment_models
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION prevent_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Физическое удаление записей из таблицы "%" запрещено. Используйте поле is_active.',
        TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_equipment_event_type_delete
    ON equipment_event_types;

CREATE TRIGGER trg_prevent_equipment_event_type_delete
BEFORE DELETE ON equipment_event_types
FOR EACH ROW
EXECUTE FUNCTION prevent_physical_delete();

DROP TRIGGER IF EXISTS trg_prevent_equipment_model_delete
    ON equipment_models;

CREATE TRIGGER trg_prevent_equipment_model_delete
BEFORE DELETE ON equipment_models
FOR EACH ROW
EXECUTE FUNCTION prevent_physical_delete();
