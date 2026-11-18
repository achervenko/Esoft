CREATE TABLE warehouse_reservations (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    item_id BIGINT NOT NULL REFERENCES warehouse_items(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity >= 0),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ(6) NOT NULL
);
CREATE UNIQUE INDEX uq_warehouse_reservations_order_item ON warehouse_reservations(order_id, item_id);
CREATE INDEX idx_warehouse_reservations_item ON warehouse_reservations(item_id);

CREATE TABLE warehouse_reservation_allocations (
    id UUID PRIMARY KEY,
    reservation_id UUID NOT NULL REFERENCES warehouse_reservations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    location_id BIGINT NOT NULL REFERENCES warehouse_storage_locations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity >= 0)
);
CREATE UNIQUE INDEX uq_warehouse_reservation_allocations_location ON warehouse_reservation_allocations(reservation_id, location_id);
CREATE INDEX idx_warehouse_reservation_allocations_location ON warehouse_reservation_allocations(location_id);

ALTER TABLE warehouse_receipt_lines
    ADD COLUMN order_id UUID REFERENCES customer_orders(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX idx_warehouse_receipt_lines_order ON warehouse_receipt_lines(order_id);
ALTER TABLE warehouse_receipt_placements ADD COLUMN reservation_snapshot JSONB;

CREATE TABLE "warehouse_reservation_requests" (
  "actor_user_id" TEXT NOT NULL,
  "request_key" UUID NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "response" JSONB NOT NULL,
  CONSTRAINT "warehouse_reservation_requests_pkey" PRIMARY KEY ("actor_user_id", "request_key"),
  CONSTRAINT "fk_warehouse_reservation_requests_actor" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE warehouse_invoice_snapshots (
    source_id UUID NOT NULL REFERENCES integration_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    invoice_id UUID NOT NULL,
    observed_at TIMESTAMPTZ(6) NOT NULL,
    received_at TIMESTAMPTZ(6) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    version BIGINT NOT NULL CHECK (version > 0),
    result JSONB,
    PRIMARY KEY (invoice_id)
);

CREATE TABLE warehouse_invoice_snapshot_versions (
    invoice_id UUID NOT NULL,
    version BIGINT NOT NULL CHECK (version > 0),
    detected_at TIMESTAMPTZ(6) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    PRIMARY KEY (invoice_id, version),
    CONSTRAINT fk_invoice_snapshot_versions_snapshot
        FOREIGN KEY (invoice_id) REFERENCES warehouse_invoice_snapshots(invoice_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE FUNCTION reject_warehouse_invoice_snapshot_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Warehouse invoice snapshot history is immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER warehouse_invoice_snapshot_history_immutable
    BEFORE UPDATE OR DELETE OR TRUNCATE ON warehouse_invoice_snapshot_versions
    FOR EACH STATEMENT EXECUTE FUNCTION reject_warehouse_invoice_snapshot_history_mutation();
