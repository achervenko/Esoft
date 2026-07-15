ALTER TYPE equipment_event_status
    ADD VALUE IF NOT EXISTS 'DRAFT'
    BEFORE 'CREATED';
