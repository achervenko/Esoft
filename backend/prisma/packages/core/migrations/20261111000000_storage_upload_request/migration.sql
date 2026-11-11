ALTER TABLE "storage_files"
    ADD COLUMN "upload_request_key" UUID,
    ADD COLUMN "upload_request_hash" VARCHAR(64),
    ADD CONSTRAINT "chk_storage_files_upload_request_pair"
        CHECK (("upload_request_key" IS NULL) = ("upload_request_hash" IS NULL));

CREATE UNIQUE INDEX "uq_storage_files_owner_upload_request"
    ON "storage_files" ("owner_module", "owner_entity_type", "owner_entity_id", "upload_request_key");
