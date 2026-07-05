CREATE OR REPLACE FUNCTION app_sync_identity_sequence(
    p_table  REGCLASS,
    p_column TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_sequence_name TEXT;
    v_max_id        BIGINT;
    v_has_rows      BOOLEAN;
BEGIN
    v_sequence_name := pg_get_serial_sequence(p_table::TEXT, p_column);

    IF v_sequence_name IS NULL THEN
        RAISE EXCEPTION 'No serial/identity sequence found for %.%', p_table, p_column;
    END IF;

    EXECUTE format(
        'SELECT COALESCE(MAX(%1$I), 1), EXISTS (SELECT 1 FROM %2$s) FROM %2$s',
        p_column,
        p_table
    )
    INTO v_max_id, v_has_rows;

    PERFORM setval(v_sequence_name, v_max_id, v_has_rows);

    IF v_has_rows THEN
        RETURN v_max_id + 1;
    END IF;

    RETURN 1;
END;
$$;
