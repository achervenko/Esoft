CREATE SEQUENCE IF NOT EXISTS equipment_visible_id_seq;

ALTER TABLE equipment
  ADD COLUMN visible_id INTEGER;

UPDATE equipment
SET visible_id = id
WHERE visible_id IS NULL;

SELECT setval(
  'equipment_visible_id_seq',
  COALESCE((SELECT MAX(visible_id) FROM equipment), 1),
  EXISTS (SELECT 1 FROM equipment)
);

ALTER SEQUENCE equipment_visible_id_seq OWNED BY equipment.visible_id;

ALTER TABLE equipment
  ALTER COLUMN visible_id SET DEFAULT nextval('equipment_visible_id_seq'::regclass),
  ALTER COLUMN visible_id SET NOT NULL;

ALTER TABLE equipment
  ADD CONSTRAINT equipment_visible_id_key UNIQUE (visible_id);

CREATE INDEX idx_equipment_visible_id ON equipment (visible_id);

COMMENT ON COLUMN equipment.id IS 'Внутренний технический идентификатор оборудования. Используется для связей и не отображается пользователю';
COMMENT ON COLUMN equipment.visible_id IS 'Видимый номер оборудования. Отображается и может быть изменен пользователем при отсутствии дублей';

DROP TRIGGER IF EXISTS trg_equipment_sync_identity_after_insert ON equipment;

CREATE TRIGGER trg_equipment_sync_identity_after_insert
AFTER INSERT ON equipment
FOR EACH STATEMENT
EXECUTE FUNCTION app_sync_identity_after_insert('visible_id');
