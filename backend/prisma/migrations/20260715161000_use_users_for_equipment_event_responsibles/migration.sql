ALTER TABLE equipment_event_responsibles
    ADD COLUMN user_id TEXT;

DO $$
DECLARE
    duplicate_employee_ids TEXT;
    missing_user_count INTEGER;
BEGIN
    SELECT string_agg(employee_id::TEXT, ', ' ORDER BY employee_id)
    INTO duplicate_employee_ids
    FROM (
        SELECT employee_id
        FROM employee_users
        GROUP BY employee_id
        HAVING count(*) > 1
    ) duplicate_employees;

    IF duplicate_employee_ids IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot migrate equipment event responsibles: employees have multiple users: %',
            duplicate_employee_ids;
    END IF;

    SELECT count(*)
    INTO missing_user_count
    FROM equipment_event_responsibles responsible
    LEFT JOIN employee_users employee_user
        ON employee_user.employee_id = responsible.employee_id
    WHERE employee_user.user_id IS NULL;

    IF missing_user_count > 0 THEN
        RAISE EXCEPTION
            'Cannot migrate equipment event responsibles: % responsibles have no linked user',
            missing_user_count;
    END IF;
END
$$;

UPDATE equipment_event_responsibles responsible
SET user_id = employee_user.user_id
FROM employee_users employee_user
WHERE employee_user.employee_id = responsible.employee_id;

DROP INDEX IF EXISTS idx_event_responsibles_employee_id;

ALTER TABLE equipment_event_responsibles
    DROP CONSTRAINT IF EXISTS fk_event_responsibles_employee,
    DROP CONSTRAINT IF EXISTS pk_equipment_event_responsibles;

ALTER TABLE equipment_event_responsibles
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE equipment_event_responsibles
    ADD CONSTRAINT pk_equipment_event_responsibles
    PRIMARY KEY (equipment_event_id, user_id);

ALTER TABLE equipment_event_responsibles
    ADD CONSTRAINT fk_event_responsibles_user
    FOREIGN KEY (user_id)
    REFERENCES "user"(id)
    ON DELETE RESTRICT;

CREATE INDEX idx_event_responsibles_user_id
    ON equipment_event_responsibles (user_id);

ALTER TABLE equipment_event_responsibles
    DROP COLUMN employee_id;
