CREATE TABLE "notifications" (
    "id" UUID PRIMARY KEY,
    "event_key" VARCHAR(255) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "target_path" VARCHAR(2000),
    "action_key" VARCHAR(255),
    "resolved_at" TIMESTAMPTZ(3),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "uq_notifications_event_key" ON "notifications" ("event_key");
CREATE INDEX "idx_notifications_occurred" ON "notifications" ("occurred_at", "id");

CREATE TABLE "notification_recipients" (
    "notification_id" UUID NOT NULL REFERENCES "notifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "user_id" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "delivered_at" TIMESTAMPTZ(3),
    "read_at" TIMESTAMPTZ(3),
    PRIMARY KEY ("notification_id", "user_id")
);

CREATE INDEX "idx_notification_recipients_user_read" ON "notification_recipients" ("user_id", "read_at");

CREATE UNIQUE INDEX "uq_notifications_active_action" ON "notifications" ("action_key")
  WHERE "resolved_at" IS NULL AND "action_key" IS NOT NULL;
