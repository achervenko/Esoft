ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'USER_PHOTO_DELETE';
ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'USER_PHOTO_UPLOAD';

CREATE TABLE "user_photos" (
    "user_id" TEXT NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "large_object_key" VARCHAR(512) NOT NULL,
    "medium_object_key" VARCHAR(512) NOT NULL,
    "small_object_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_photos_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "idx_user_photos_uploaded_by_user_id" ON "user_photos"("uploaded_by_user_id");

ALTER TABLE "user_photos"
    ADD CONSTRAINT "user_photos_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_photos"
    ADD CONSTRAINT "user_photos_uploaded_by_user_id_fkey"
    FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
