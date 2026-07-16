DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'checklist_answer_type'
    ) THEN
        CREATE TYPE checklist_answer_type AS ENUM (
            'BOOLEAN',
            'INTEGER',
            'DECIMAL',
            'TEXT',
            'DATE'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'checklist_status'
    ) THEN
        CREATE TYPE checklist_status AS ENUM (
            'CREATED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED',
            'INVALIDATED'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'checklist_result'
    ) THEN
        CREATE TYPE checklist_result AS ENUM (
            'PASSED',
            'FAILED',
            'WITH_REMARKS'
        );
    END IF;
END
$$;

CREATE TABLE checklist_modules (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,

    CONSTRAINT fk_checklist_modules_created_by
        FOREIGN KEY (created_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklist_modules_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_checklist_modules_name
        UNIQUE (name)
);

CREATE INDEX idx_checklist_modules_is_active
    ON checklist_modules (is_active);

CREATE TABLE checklist_questions (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checklist_module_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    answer_type checklist_answer_type NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,

    CONSTRAINT fk_checklist_questions_module
        FOREIGN KEY (checklist_module_id)
        REFERENCES checklist_modules(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklist_questions_created_by
        FOREIGN KEY (created_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklist_questions_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_checklist_questions_module_id
    ON checklist_questions (checklist_module_id);

CREATE INDEX idx_checklist_questions_answer_type
    ON checklist_questions (answer_type);

CREATE INDEX idx_checklist_questions_is_active
    ON checklist_questions (is_active);

CREATE TABLE checklist_templates (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    equipment_model_id INTEGER NOT NULL,
    maintenance_type_id INTEGER NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT false,
    based_on_template_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT,
    published_at TIMESTAMPTZ,
    published_by TEXT,
    archived_at TIMESTAMPTZ,
    archived_by TEXT,

    CONSTRAINT fk_checklist_templates_equipment_model
        FOREIGN KEY (equipment_model_id)
        REFERENCES equipment_models(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklist_templates_maintenance_type
        FOREIGN KEY (maintenance_type_id)
        REFERENCES equipment_event_types(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklist_templates_based_on
        FOREIGN KEY (based_on_template_id)
        REFERENCES checklist_templates(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_checklist_templates_created_by
        FOREIGN KEY (created_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklist_templates_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklist_templates_published_by
        FOREIGN KEY (published_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklist_templates_archived_by
        FOREIGN KEY (archived_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_checklist_templates_publish_state
        CHECK (
            (
                is_published = false
                AND published_at IS NULL
                AND published_by IS NULL
            )
            OR
            (
                is_published = true
                AND published_at IS NOT NULL
                AND published_by IS NOT NULL
            )
        ),

    CONSTRAINT chk_checklist_templates_archive_state
        CHECK (
            (
                archived_at IS NULL
                AND archived_by IS NULL
            )
            OR
            (
                archived_at IS NOT NULL
                AND archived_by IS NOT NULL
            )
        )
);

CREATE INDEX idx_checklist_templates_equipment_model_id
    ON checklist_templates (equipment_model_id);

CREATE INDEX idx_checklist_templates_maintenance_type_id
    ON checklist_templates (maintenance_type_id);

CREATE INDEX idx_checklist_templates_is_active
    ON checklist_templates (is_active);

CREATE INDEX idx_checklist_templates_is_published
    ON checklist_templates (is_published);

CREATE INDEX idx_checklist_templates_based_on_id
    ON checklist_templates (based_on_template_id);

CREATE TABLE checklist_template_modules (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checklist_template_id INTEGER NOT NULL,
    checklist_module_id INTEGER NOT NULL,
    module_name_snapshot VARCHAR(128) NOT NULL,
    sort_order INTEGER NOT NULL,

    CONSTRAINT fk_checklist_template_modules_template
        FOREIGN KEY (checklist_template_id)
        REFERENCES checklist_templates(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_checklist_template_modules_module
        FOREIGN KEY (checklist_module_id)
        REFERENCES checklist_modules(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_checklist_template_modules_module
        UNIQUE (checklist_template_id, checklist_module_id),

    CONSTRAINT uq_checklist_template_modules_sort
        UNIQUE (checklist_template_id, sort_order),

    CONSTRAINT chk_checklist_template_modules_sort_order
        CHECK (sort_order > 0)
);

CREATE TABLE checklist_template_questions (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checklist_template_module_id INTEGER NOT NULL,
    checklist_question_id INTEGER NOT NULL,
    question_text_snapshot TEXT NOT NULL,
    answer_type_snapshot checklist_answer_type NOT NULL,
    sort_order INTEGER NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT fk_checklist_template_questions_module
        FOREIGN KEY (checklist_template_module_id)
        REFERENCES checklist_template_modules(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_checklist_template_questions_question
        FOREIGN KEY (checklist_question_id)
        REFERENCES checklist_questions(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_checklist_template_questions_question
        UNIQUE (checklist_template_module_id, checklist_question_id),

    CONSTRAINT uq_checklist_template_questions_sort
        UNIQUE (checklist_template_module_id, sort_order),

    CONSTRAINT chk_checklist_template_questions_sort_order
        CHECK (sort_order > 0)
);

CREATE TABLE equipment_maintenance_setting_checklist_templates (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    maintenance_setting_id INTEGER NOT NULL,
    checklist_template_id INTEGER NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NOT NULL,

    CONSTRAINT fk_setting_checklist_templates_setting
        FOREIGN KEY (maintenance_setting_id)
        REFERENCES equipment_maintenance_settings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_setting_checklist_templates_template
        FOREIGN KEY (checklist_template_id)
        REFERENCES checklist_templates(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_setting_checklist_templates_created_by
        FOREIGN KEY (created_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_setting_checklist_templates_template
        UNIQUE (maintenance_setting_id, checklist_template_id),

    CONSTRAINT uq_setting_checklist_templates_sort
        UNIQUE (maintenance_setting_id, sort_order),

    CONSTRAINT chk_setting_checklist_templates_sort_order
        CHECK (sort_order > 0)
);

CREATE INDEX idx_setting_checklist_templates_template_id
    ON equipment_maintenance_setting_checklist_templates (checklist_template_id);

CREATE TABLE checklists (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    equipment_event_id INTEGER NOT NULL,
    equipment_id INTEGER NOT NULL,
    checklist_template_id INTEGER NOT NULL,
    assigned_user_id TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL,
    status checklist_status NOT NULL DEFAULT 'CREATED',
    result checklist_result,
    checklist_date DATE,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    comment TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT,
    cancellation_reason TEXT,
    invalidated_at TIMESTAMPTZ,
    invalidated_by TEXT,
    invalidation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NOT NULL,

    CONSTRAINT fk_checklists_event
        FOREIGN KEY (equipment_event_id)
        REFERENCES equipment_events(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_checklists_equipment
        FOREIGN KEY (equipment_id)
        REFERENCES equipment(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklists_template
        FOREIGN KEY (checklist_template_id)
        REFERENCES checklist_templates(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklists_assigned_user
        FOREIGN KEY (assigned_user_id)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklists_event_responsible
        FOREIGN KEY (equipment_event_id, assigned_user_id)
        REFERENCES equipment_event_responsibles(equipment_event_id, user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklists_cancelled_by
        FOREIGN KEY (cancelled_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklists_invalidated_by
        FOREIGN KEY (invalidated_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_checklists_created_by
        FOREIGN KEY (created_by)
        REFERENCES "user"(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_checklists_event_template
        UNIQUE (equipment_event_id, checklist_template_id),

    CONSTRAINT uq_checklists_event_sort
        UNIQUE (equipment_event_id, sort_order),

    CONSTRAINT chk_checklists_sort_order
        CHECK (sort_order > 0),

    CONSTRAINT chk_checklists_result_completed
        CHECK (
            (status = 'COMPLETED' AND result IS NOT NULL)
            OR
            (status <> 'COMPLETED' AND result IS NULL)
        ),

    CONSTRAINT chk_checklists_started_at
        CHECK (
            status NOT IN ('IN_PROGRESS', 'COMPLETED')
            OR started_at IS NOT NULL
        ),

    CONSTRAINT chk_checklists_completed_at
        CHECK (
            status <> 'COMPLETED'
            OR completed_at IS NOT NULL
        ),

    CONSTRAINT chk_checklists_cancelled_state
        CHECK (
            (
                status <> 'CANCELLED'
                AND cancelled_at IS NULL
                AND cancelled_by IS NULL
                AND cancellation_reason IS NULL
            )
            OR
            (
                status = 'CANCELLED'
                AND cancelled_at IS NOT NULL
                AND cancelled_by IS NOT NULL
                AND cancellation_reason IS NOT NULL
            )
        ),

    CONSTRAINT chk_checklists_invalidated_state
        CHECK (
            (
                status <> 'INVALIDATED'
                AND invalidated_at IS NULL
                AND invalidated_by IS NULL
                AND invalidation_reason IS NULL
            )
            OR
            (
                status = 'INVALIDATED'
                AND invalidated_at IS NOT NULL
                AND invalidated_by IS NOT NULL
                AND invalidation_reason IS NOT NULL
            )
        )
);

CREATE INDEX idx_checklists_event_id
    ON checklists (equipment_event_id);

CREATE INDEX idx_checklists_equipment_id
    ON checklists (equipment_id);

CREATE INDEX idx_checklists_template_id
    ON checklists (checklist_template_id);

CREATE INDEX idx_checklists_assigned_user_id
    ON checklists (assigned_user_id);

CREATE INDEX idx_checklists_status
    ON checklists (status);

CREATE TABLE checklist_details (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checklist_id INTEGER NOT NULL,
    checklist_template_question_id INTEGER,
    checklist_question_id INTEGER,
    module_name TEXT NOT NULL,
    module_sort_order INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    answer_type checklist_answer_type NOT NULL,
    question_sort_order INTEGER NOT NULL,
    is_required BOOLEAN NOT NULL,
    answer_boolean BOOLEAN,
    answer_integer INTEGER,
    answer_decimal NUMERIC(18, 6),
    answer_text TEXT,
    answer_date DATE,
    answered_at TIMESTAMPTZ,

    CONSTRAINT fk_checklist_details_checklist
        FOREIGN KEY (checklist_id)
        REFERENCES checklists(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_checklist_details_template_question
        FOREIGN KEY (checklist_template_question_id)
        REFERENCES checklist_template_questions(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_checklist_details_question
        FOREIGN KEY (checklist_question_id)
        REFERENCES checklist_questions(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_checklist_details_order
        UNIQUE (checklist_id, module_sort_order, question_sort_order),

    CONSTRAINT chk_checklist_details_module_sort_order
        CHECK (module_sort_order > 0),

    CONSTRAINT chk_checklist_details_question_sort_order
        CHECK (question_sort_order > 0),

    CONSTRAINT chk_checklist_details_answer_matches_type
        CHECK (
            (
                answer_type = 'BOOLEAN'
                AND answer_integer IS NULL
                AND answer_decimal IS NULL
                AND answer_text IS NULL
                AND answer_date IS NULL
            )
            OR
            (
                answer_type = 'INTEGER'
                AND answer_boolean IS NULL
                AND answer_decimal IS NULL
                AND answer_text IS NULL
                AND answer_date IS NULL
            )
            OR
            (
                answer_type = 'DECIMAL'
                AND answer_boolean IS NULL
                AND answer_integer IS NULL
                AND answer_text IS NULL
                AND answer_date IS NULL
            )
            OR
            (
                answer_type = 'TEXT'
                AND answer_boolean IS NULL
                AND answer_integer IS NULL
                AND answer_decimal IS NULL
                AND answer_date IS NULL
            )
            OR
            (
                answer_type = 'DATE'
                AND answer_boolean IS NULL
                AND answer_integer IS NULL
                AND answer_decimal IS NULL
                AND answer_text IS NULL
            )
        )
);

CREATE INDEX idx_checklist_details_checklist_id
    ON checklist_details (checklist_id);

CREATE INDEX idx_checklist_details_template_question_id
    ON checklist_details (checklist_template_question_id);

CREATE INDEX idx_checklist_details_question_id
    ON checklist_details (checklist_question_id);
