ALTER TABLE equipment
ADD COLUMN operation_text TEXT;

COMMENT ON COLUMN equipment.operation_text IS 'Технологическая операция в текстовом формате';
