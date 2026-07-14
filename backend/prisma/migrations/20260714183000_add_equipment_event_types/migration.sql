DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'equipment_models_manufacturer_id_fkey'
          AND conrelid = 'equipment_models'::regclass
    ) THEN
        ALTER TABLE equipment_models
            RENAME CONSTRAINT equipment_models_manufacturer_id_fkey
            TO fk_equipment_models_manufacturer;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'equipment_models_name_not_empty'
          AND conrelid = 'equipment_models'::regclass
    ) THEN
        ALTER TABLE equipment_models
            RENAME CONSTRAINT equipment_models_name_not_empty
            TO chk_equipment_models_name_not_blank;
    END IF;
END $$;

CREATE TABLE equipment_event_types (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(64) NOT NULL,
    code VARCHAR(32) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT uq_equipment_event_types_name
        UNIQUE (name),

    CONSTRAINT uq_equipment_event_types_code
        UNIQUE (code),

    CONSTRAINT chk_equipment_event_types_name_not_blank
        CHECK (btrim(name) <> ''),

    CONSTRAINT chk_equipment_event_types_code_not_blank
        CHECK (btrim(code) <> '')
);

CREATE TABLE equipment_model_event_types (
    equipment_model_id INTEGER NOT NULL,
    event_type_id BIGINT NOT NULL,

    CONSTRAINT pk_equipment_model_event_types
        PRIMARY KEY (
            equipment_model_id,
            event_type_id
        ),

    CONSTRAINT fk_model_event_types_model
        FOREIGN KEY (equipment_model_id)
        REFERENCES equipment_models(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_model_event_types_event_type
        FOREIGN KEY (event_type_id)
        REFERENCES equipment_event_types(id)
        ON DELETE RESTRICT
);
