

-- CreateEnum
CREATE TYPE "equipment_maintenance_execution_type" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "equipment_status" AS ENUM ('active', 'reserve', 'repair', 'maintenance', 'written_off');

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_models" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "manufacturer_id" INTEGER NOT NULL,

    CONSTRAINT "equipment_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_event_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "equipment_event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_maintenance_settings" (
    "id" SERIAL NOT NULL,
    "equipment_model_id" INTEGER NOT NULL,
    "maintenance_type_id" INTEGER NOT NULL,
    "default_checklist_template_id" INTEGER,
    "execution_type" "equipment_maintenance_execution_type" NOT NULL,
    "periodicity_years" INTEGER,
    "periodicity_months" INTEGER,
    "periodicity_weeks" INTEGER,
    "periodicity_days" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "equipment_maintenance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_event_extensions" (
    "event_id" INTEGER NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "event_type_id" INTEGER NOT NULL,
    "maintenance_setting_id" INTEGER NOT NULL,
    "execution_type" "equipment_maintenance_execution_type" NOT NULL,

    CONSTRAINT "equipment_event_extensions_pkey" PRIMARY KEY ("event_id")
);

-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS equipment_visible_id_seq INCREMENT BY 1 CACHE 1;

-- CreateTable
CREATE TABLE "equipment" (
    "id" SERIAL NOT NULL,
    "visible_id" INTEGER NOT NULL DEFAULT nextval('equipment_visible_id_seq'::regclass),
    "inventory_number" VARCHAR(64) NOT NULL,
    "serial_number" VARCHAR(128),
    "name" VARCHAR(128) NOT NULL,
    "model_id" INTEGER NOT NULL,
    "specifications" VARCHAR(4000),
    "country_id" INTEGER,
    "manufacture_year" SMALLINT,
    "commissioning_date" DATE,
    "issue_date" DATE NOT NULL,
    "section_id" INTEGER NOT NULL,
    "responsible_employee_id" INTEGER NOT NULL,
    "status" "equipment_status" NOT NULL DEFAULT 'active',
    "operation_text" VARCHAR(4000),
    "notes" VARCHAR(4000),

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- LinkSequenceToColumn
ALTER SEQUENCE equipment_visible_id_seq
    OWNED BY equipment.visible_id;

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_name_key" ON "manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_equipment_models_manufacturer_name" ON "equipment_models"("manufacturer_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_equipment_event_types_name" ON "equipment_event_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_equipment_event_types_code" ON "equipment_event_types"("code");

-- CreateIndex
CREATE INDEX "idx_equipment_event_types_sort_order" ON "equipment_event_types"("sort_order");

-- CreateIndex
CREATE INDEX "idx_equipment_maintenance_settings_type_id" ON "equipment_maintenance_settings"("maintenance_type_id");

-- CreateIndex
CREATE INDEX "idx_equipment_maintenance_settings_default_template_id" ON "equipment_maintenance_settings"("default_checklist_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_equipment_maintenance_settings_model_type" ON "equipment_maintenance_settings"("equipment_model_id", "maintenance_type_id");

-- CreateIndex
CREATE INDEX "idx_equipment_event_extensions_equipment_type" ON "equipment_event_extensions"("equipment_id", "event_type_id");

-- CreateIndex
CREATE INDEX "idx_equipment_event_extensions_event_type" ON "equipment_event_extensions"("event_type_id");

-- CreateIndex
CREATE INDEX "idx_equipment_event_extensions_maintenance_setting" ON "equipment_event_extensions"("maintenance_setting_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_visible_id_key" ON "equipment"("visible_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_inventory_number_key" ON "equipment"("inventory_number");

-- CreateIndex
CREATE INDEX "idx_equipment_serial_number" ON "equipment"("serial_number");

-- CreateIndex
CREATE INDEX "idx_equipment_status" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "idx_equipment_model_id" ON "equipment"("model_id");

-- CreateIndex
CREATE INDEX "idx_equipment_section_id" ON "equipment"("section_id");

-- CreateIndex
CREATE INDEX "idx_equipment_responsible_employee_id" ON "equipment"("responsible_employee_id");

-- AddForeignKey
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_maintenance_settings" ADD CONSTRAINT "equipment_maintenance_settings_equipment_model_id_fkey" FOREIGN KEY ("equipment_model_id") REFERENCES "equipment_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_maintenance_settings" ADD CONSTRAINT "equipment_maintenance_settings_maintenance_type_id_fkey" FOREIGN KEY ("maintenance_type_id") REFERENCES "equipment_event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_maintenance_settings" ADD CONSTRAINT "fk_equipment_maintenance_settings_default_template" FOREIGN KEY ("default_checklist_template_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_event_extensions" ADD CONSTRAINT "equipment_event_extensions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_event_extensions" ADD CONSTRAINT "equipment_event_extensions_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_event_extensions" ADD CONSTRAINT "equipment_event_extensions_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "equipment_event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_event_extensions" ADD CONSTRAINT "equipment_event_extensions_maintenance_setting_id_fkey" FOREIGN KEY ("maintenance_setting_id") REFERENCES "equipment_maintenance_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "equipment_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_responsible_employee_id_fkey" FOREIGN KEY ("responsible_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION app_normalize_equipment_optional_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.specifications := NULLIF(btrim(COALESCE(NEW.specifications, '')), '');
  NEW.operation_text := NULLIF(btrim(COALESCE(NEW.operation_text, '')), '');
  NEW.notes := NULLIF(btrim(COALESCE(NEW.notes, '')), '');
  NEW.serial_number := NULLIF(btrim(COALESCE(NEW.serial_number, '')), '');

  IF NEW.serial_number IS NOT NULL
    AND lower(NEW.serial_number) = 'б/н' THEN
    NEW.serial_number := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW admin_equipment_full AS
SELECT
    e.id,
    e.visible_id,
    e.inventory_number,
    e.serial_number,
    e.name AS equipment_name,
    e.model_id,
    em.name AS model,
    e.specifications,

    em.manufacturer_id,
    m.name AS manufacturer_name,

    e.country_id,
    c.name AS country_name,
    c.iso AS country_iso,

    e.manufacture_year,
    e.commissioning_date,
    e.issue_date,

    e.section_id,
    s.name AS section_name,

    s.workshop_id,
    w.name AS workshop_name,

    e.responsible_employee_id,
    concat_ws(
        ' ',
        emp.last_name,
        emp.first_name,
        emp.middle_name
    ) AS responsible_employee_name,
    p.name AS responsible_employee_position,

    e.status,
    e.operation_text,
    e.notes

FROM equipment e
JOIN equipment_models em
    ON em.id = e.model_id
JOIN manufacturers m
    ON m.id = em.manufacturer_id
LEFT JOIN countries c
    ON c.id = e.country_id
JOIN sections s
    ON s.id = e.section_id
JOIN workshops w
    ON w.id = s.workshop_id
JOIN employees emp
    ON emp.id = e.responsible_employee_id
JOIN positions p
    ON p.id = emp.position_id;

CREATE TRIGGER trg_equipment_lock_identity_writes
BEFORE INSERT OR UPDATE OF visible_id ON equipment
FOR EACH STATEMENT
EXECUTE FUNCTION app_lock_identity_writes('visible_id');

CREATE TRIGGER trg_equipment_sync_identity_after_insert
AFTER INSERT OR UPDATE OF visible_id ON equipment
FOR EACH STATEMENT
EXECUTE FUNCTION app_sync_identity_after_insert('visible_id');

CREATE TRIGGER trg_prevent_equipment_event_type_delete
BEFORE DELETE ON equipment_event_types
FOR EACH ROW
EXECUTE FUNCTION prevent_physical_delete();

CREATE TRIGGER trg_prevent_equipment_model_delete
BEFORE DELETE ON equipment_models
FOR EACH ROW
EXECUTE FUNCTION prevent_physical_delete();

CREATE TRIGGER trg_prevent_manufacturer_delete
BEFORE DELETE ON manufacturers
FOR EACH ROW
EXECUTE FUNCTION prevent_physical_delete();

CREATE TRIGGER trg_equipment_normalize_optional_fields
BEFORE INSERT OR UPDATE ON equipment
FOR EACH ROW
EXECUTE FUNCTION app_normalize_equipment_optional_fields();

-- Equipment dictionary lifecycle.
ALTER TABLE "manufacturers" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "equipment_models" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Registry pagination and indexed search.
-- Natural Russian ordering: numerical fragments sort as numbers.
-- This collation is used only for ordering, not uniqueness or pattern matching.

CREATE INDEX idx_equipment_registry_name ON equipment ((lower(name) COLLATE app_registry_order), id);
CREATE INDEX idx_equipment_registry_inventory ON equipment ((lower(inventory_number) COLLATE app_registry_order), id);
CREATE INDEX idx_equipment_registry_serial ON equipment ((lower(coalesce(serial_number, 'б/н')) COLLATE app_registry_order), id);

CREATE INDEX idx_search_equipment_text_trgm ON search_index USING gin (app_search_normalize(search_text) gin_trgm_ops) WHERE entity_type = 'equipment' AND is_active = true;
CREATE INDEX idx_search_equipment_title_trgm ON search_index USING gin (app_search_normalize(title) gin_trgm_ops) WHERE entity_type = 'equipment' AND is_active = true;
