BEGIN;

DROP VIEW IF EXISTS admin_equipment_full;

ALTER SEQUENCE equipment_visible_id_seq
  OWNED BY equipment.visible_id;

ALTER TABLE equipment
  ALTER COLUMN visible_id
  SET DEFAULT nextval('equipment_visible_id_seq'::regclass);

SELECT setval(
  'equipment_visible_id_seq',
  COALESCE((SELECT MAX(visible_id) FROM equipment), 1),
  EXISTS (SELECT 1 FROM equipment)
);

DROP INDEX IF EXISTS idx_equipment_visible_id;

UPDATE equipment
SET
  specifications = NULLIF(btrim(COALESCE(specifications, '')), ''),
  operation_text = NULLIF(btrim(COALESCE(operation_text, '')), ''),
  notes = NULLIF(btrim(COALESCE(notes, '')), ''),
  serial_number = CASE
    WHEN NULLIF(btrim(COALESCE(serial_number, '')), '') IS NULL THEN NULL
    WHEN lower(btrim(serial_number)) = 'б/н' THEN NULL
    ELSE btrim(serial_number)
  END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM equipment
    WHERE char_length(specifications) > 4000
       OR char_length(operation_text) > 4000
       OR char_length(notes) > 4000
  ) THEN
    RAISE EXCEPTION
      'В equipment обнаружены текстовые поля длиннее 4000 символов';
  END IF;
END;
$$;

ALTER TABLE equipment
  ALTER COLUMN specifications TYPE VARCHAR(4000),
  ALTER COLUMN operation_text TYPE VARCHAR(4000),
  ALTER COLUMN notes TYPE VARCHAR(4000);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM equipment
    WHERE issue_date IS NULL
  ) THEN
    RAISE EXCEPTION
      'Нельзя сделать equipment.issue_date обязательным: найдены записи без даты выдачи';
  END IF;
END;
$$;

ALTER TABLE equipment
  DROP CONSTRAINT IF EXISTS equipment_manufacturer_id_fkey,
  DROP COLUMN IF EXISTS manufacturer_id;

ALTER TABLE equipment
  DROP CONSTRAINT IF EXISTS equipment_manufacture_year_range_chk,
  DROP CONSTRAINT IF EXISTS equipment_commissioning_not_before_manufacture_chk,
  DROP CONSTRAINT IF EXISTS equipment_issue_not_before_commissioning_chk,
  DROP CONSTRAINT IF EXISTS equipment_issue_not_before_manufacture_year_chk;

ALTER TABLE equipment
  ALTER COLUMN issue_date SET NOT NULL,
  ADD CONSTRAINT equipment_manufacture_year_range_chk
    CHECK (
      manufacture_year IS NULL
      OR manufacture_year BETWEEN 1900 AND 2100
    ),
  ADD CONSTRAINT equipment_commissioning_not_before_manufacture_chk
    CHECK (
      commissioning_date IS NULL
      OR manufacture_year IS NULL
      OR EXTRACT(YEAR FROM commissioning_date)::INT >= manufacture_year
    ),
  ADD CONSTRAINT equipment_issue_not_before_commissioning_chk
    CHECK (
      issue_date IS NULL
      OR commissioning_date IS NULL
      OR issue_date >= commissioning_date
    ),
  ADD CONSTRAINT equipment_issue_not_before_manufacture_year_chk
    CHECK (
      issue_date IS NULL
      OR commissioning_date IS NOT NULL
      OR manufacture_year IS NULL
      OR EXTRACT(YEAR FROM issue_date)::INT >= manufacture_year
    );

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

DROP TRIGGER IF EXISTS trg_equipment_normalize_optional_fields ON equipment;

CREATE TRIGGER trg_equipment_normalize_optional_fields
BEFORE INSERT OR UPDATE ON equipment
FOR EACH ROW
EXECUTE FUNCTION app_normalize_equipment_optional_fields();

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
    emp.position AS responsible_employee_position,

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
    ON emp.id = e.responsible_employee_id;

COMMIT;
