BEGIN;
CREATE TABLE customer_orders (
 id uuid PRIMARY KEY,
 source_id uuid NOT NULL REFERENCES integration_sources(id) ON DELETE RESTRICT,
 external_id uuid,
 number varchar(100) NOT NULL,
 name varchar(1000) NOT NULL,
 document_date varchar(19) NOT NULL,
 status varchar(100) NOT NULL,
 posted boolean NOT NULL,
 deletion_mark boolean NOT NULL,
 missing_checks integer NOT NULL DEFAULT 0 CHECK (missing_checks BETWEEN 0 AND 2),
 checked_at timestamptz NOT NULL,
 changed_at timestamptz NOT NULL,
 CONSTRAINT uq_customer_orders_external UNIQUE(source_id,external_id)
);
CREATE INDEX idx_customer_orders_number ON customer_orders(number,id);
CREATE TABLE customer_order_changes (
 id bigserial PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
 before jsonb,
 after jsonb NOT NULL,
 observed_at timestamptz NOT NULL
);
CREATE INDEX idx_customer_order_changes_order ON customer_order_changes(order_id,id);
CREATE TABLE order_sync_runs (
 id uuid PRIMARY KEY,
 source_id uuid NOT NULL REFERENCES integration_sources(id) ON DELETE RESTRICT,
 started_at timestamptz NOT NULL,
 finished_at timestamptz NOT NULL,
 outcome varchar(20) NOT NULL,
 received integer,
 changed integer,
 error_code varchar(100)
);
CREATE INDEX idx_order_sync_runs_source ON order_sync_runs(source_id,started_at,id);
COMMIT;
