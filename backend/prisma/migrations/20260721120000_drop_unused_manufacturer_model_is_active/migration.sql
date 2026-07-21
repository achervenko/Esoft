DROP TRIGGER IF EXISTS trg_prevent_manufacturer_delete
    ON manufacturers;

DROP TRIGGER IF EXISTS trg_prevent_equipment_model_delete
    ON equipment_models;

ALTER TABLE manufacturers
    DROP COLUMN IF EXISTS is_active;

ALTER TABLE equipment_models
    DROP COLUMN IF EXISTS is_active;
