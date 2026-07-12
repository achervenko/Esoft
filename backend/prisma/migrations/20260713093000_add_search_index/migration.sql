CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE search_index (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_id INTEGER NOT NULL,
    title VARCHAR(256) NOT NULL,
    subtitle TEXT,
    search_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_search_index_entity UNIQUE (entity_type, entity_id),
    CONSTRAINT chk_search_index_entity_type_not_empty CHECK (btrim(entity_type) <> ''),
    CONSTRAINT chk_search_index_title_not_empty CHECK (btrim(title) <> ''),
    CONSTRAINT chk_search_index_search_text_not_empty CHECK (btrim(search_text) <> '')
);

CREATE INDEX idx_search_index_entity_type
    ON search_index (entity_type);

CREATE INDEX idx_search_index_search_text_active_trgm
    ON search_index
    USING GIN (search_text gin_trgm_ops)
    WHERE is_active = true;
