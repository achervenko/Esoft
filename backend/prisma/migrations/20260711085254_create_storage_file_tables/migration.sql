-- CreateTable
CREATE TABLE "storage_files" (
    "id" SERIAL NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT timezone('Europe/Moscow'::text, now()),
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "storage_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_attachments" (
    "id" SERIAL NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "file_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT timezone('Europe/Moscow'::text, now()),

    CONSTRAINT "equipment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storage_files_object_key_key" ON "storage_files"("object_key");

-- CreateIndex
CREATE INDEX "idx_storage_files_bucket" ON "storage_files"("bucket");

-- CreateIndex
CREATE INDEX "idx_storage_files_created_at" ON "storage_files"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_storage_files_uploaded_by_user_id" ON "storage_files"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "idx_storage_files_deleted_at" ON "storage_files"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_attachments_file_id_key" ON "equipment_attachments"("file_id");

-- CreateIndex
CREATE INDEX "idx_equipment_attachments_equipment_created_at" ON "equipment_attachments"("equipment_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "storage_files" ADD CONSTRAINT "storage_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_attachments" ADD CONSTRAINT "equipment_attachments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_attachments" ADD CONSTRAINT "equipment_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "storage_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
