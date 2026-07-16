ALTER TABLE checklists
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE checklist_details
    ADD COLUMN IF NOT EXISTS answered_by TEXT;

ALTER TABLE checklist_details
    ADD CONSTRAINT fk_checklist_details_answered_by
    FOREIGN KEY (answered_by)
    REFERENCES "user"(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_details_answered_by
    ON checklist_details (answered_by);

ALTER TABLE checklists
    DROP CONSTRAINT IF EXISTS fk_checklists_started_by,
    ADD CONSTRAINT fk_checklists_started_by
    FOREIGN KEY (started_by)
    REFERENCES "user"(id)
    ON DELETE SET NULL;

ALTER TABLE checklists
    DROP CONSTRAINT IF EXISTS fk_checklists_completed_by,
    ADD CONSTRAINT fk_checklists_completed_by
    FOREIGN KEY (completed_by)
    REFERENCES "user"(id)
    ON DELETE SET NULL;

ALTER TABLE checklists
    DROP CONSTRAINT IF EXISTS chk_checklists_result_terminal,
    DROP CONSTRAINT IF EXISTS chk_checklists_result_completed;

ALTER TABLE checklists
    ADD CONSTRAINT chk_checklists_result_terminal
    CHECK (
        (
            status = 'INVALIDATED'
            AND result IS NOT NULL
        )
        OR status <> 'INVALIDATED'
    );
