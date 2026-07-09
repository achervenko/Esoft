DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM equipment
    WHERE responsible_employee_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot require equipment.responsible_employee_id while equipment rows with NULL responsible_employee_id exist.';
  END IF;
END $$;

ALTER TABLE equipment
  DROP CONSTRAINT equipment_responsible_employee_id_fkey;

ALTER TABLE equipment
  ALTER COLUMN responsible_employee_id SET NOT NULL;

ALTER TABLE equipment
  ADD CONSTRAINT equipment_responsible_employee_id_fkey
  FOREIGN KEY (responsible_employee_id)
  REFERENCES employees(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

COMMENT ON COLUMN equipment.responsible_employee_id IS 'Ответственный сотрудник за оборудование. Обязательное поле';
