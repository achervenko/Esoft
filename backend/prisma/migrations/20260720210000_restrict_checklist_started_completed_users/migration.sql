ALTER TABLE checklists
    DROP CONSTRAINT IF EXISTS fk_checklists_started_by,
    ADD CONSTRAINT fk_checklists_started_by
    FOREIGN KEY (started_by)
    REFERENCES "user"(id)
    ON DELETE RESTRICT;

ALTER TABLE checklists
    DROP CONSTRAINT IF EXISTS fk_checklists_completed_by,
    ADD CONSTRAINT fk_checklists_completed_by
    FOREIGN KEY (completed_by)
    REFERENCES "user"(id)
    ON DELETE RESTRICT;
