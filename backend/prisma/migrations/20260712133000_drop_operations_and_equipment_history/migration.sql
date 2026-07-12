ALTER TABLE "equipment"
DROP CONSTRAINT IF EXISTS "equipment_operation_id_fkey";

DROP TABLE IF EXISTS "equipment_history";

DROP TABLE IF EXISTS "operations";

DROP INDEX IF EXISTS "idx_equipment_operation_id";

ALTER TABLE "equipment"
DROP COLUMN IF EXISTS "operation_id";

DROP TYPE IF EXISTS "equipment_change_type";
