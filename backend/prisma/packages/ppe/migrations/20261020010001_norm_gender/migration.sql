-- Existing norms need explicit classification; never assume a gender.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM ppe_norms) THEN
  RAISE EXCEPTION 'Norm gender migration requires explicit classification of existing norms. No default gender is assigned.';
 END IF;
END $$;
ALTER TABLE "ppe_norms" ADD COLUMN "gender" "gender" NOT NULL;
ALTER TABLE "ppe_issues" ADD COLUMN "gender_snapshot" "gender";
DROP INDEX "idx_ppe_norms_position_effective_from";
CREATE INDEX "idx_ppe_norms_position_effective_from" ON "ppe_norms"("position_id", "gender", "effective_from");
CREATE FUNCTION enforce_ppe_norm_gender() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND (NEW.gender IS DISTINCT FROM OLD.gender OR NEW.position_id <> OLD.position_id) THEN
  RAISE EXCEPTION 'Norm position and gender are immutable' USING ERRCODE = '23514';
 END IF;
 IF NEW.previous_norm_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM ppe_norms WHERE id = NEW.previous_norm_id AND position_id = NEW.position_id AND gender = NEW.gender
 ) THEN
  RAISE EXCEPTION 'Norm revision must preserve position and gender' USING ERRCODE = '23514';
 END IF;
 PERFORM id FROM positions WHERE id = NEW.position_id FOR UPDATE;
 IF EXISTS (SELECT 1 FROM ppe_norms n WHERE n.position_id = NEW.position_id AND n.gender = NEW.gender
   AND n.id <> NEW.id AND (NEW.effective_to IS NULL OR n.effective_from <= NEW.effective_to)
   AND (n.effective_to IS NULL OR n.effective_to >= NEW.effective_from)) THEN
  RAISE EXCEPTION 'Norm periods overlap for position and gender' USING ERRCODE = '23P01';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_ppe_norm_gender BEFORE INSERT OR UPDATE ON ppe_norms FOR EACH ROW EXECUTE FUNCTION enforce_ppe_norm_gender();
