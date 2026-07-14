ALTER TABLE manufacturers
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

DROP TRIGGER IF EXISTS trg_prevent_manufacturer_delete
    ON manufacturers;

CREATE TRIGGER trg_prevent_manufacturer_delete
BEFORE DELETE ON manufacturers
FOR EACH ROW
EXECUTE FUNCTION prevent_physical_delete();
