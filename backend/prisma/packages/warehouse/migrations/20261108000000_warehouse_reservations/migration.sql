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
